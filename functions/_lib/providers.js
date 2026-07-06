/**
 * LLM 供应商抽象层
 * - DeepSeek  (api.deepseek.com)            ★ 默认
 * - MiniMax   (api.minimax.chat / api.minimax.io)
 * - GLM/ZhipuAI (open.bigmodel.cn)
 *
 * 三家都是 OpenAI 风格的 chat completions API，只是 endpoint/model 不同。
 * 所有密钥从 Cloudflare 环境变量读取，绝不在前端暴露。
 *
 * 环境变量约定：
 *   DEEPSEEK_API_KEY    必填（deepseek 路径）
 *   DEEPSEEK_MODEL      可选，默认 "deepseek-v4-flash"
 *   DEEPSEEK_ENDPOINT   可选，默认 "https://api.deepseek.com/chat/completions"
 *   MINIMAX_API_KEY     必填（minimax 路径）
 *   MINIMAX_MODEL       可选，默认 "MiniMax-M3"
 *   MINIMAX_ENDPOINT    可选，默认 "https://api.minimax.chat/v1/text/chatcompletion_v2"
 *   GLM_API_KEY         必填（glm 路径）
 *   GLM_MODEL           可选，默认 "glm-4.5"
 *   GLM_ENDPOINT        可选，默认 "https://open.bigmodel.cn/api/paas/v4/chat/completions"
 *   DEFAULT_PROVIDER    可选，默认 "deepseek"
 *   ADMIN_TOKEN         必填（管理员切换 provider 时校验）
 */

const PROVIDERS = {
  deepseek: {
    defaultModel: 'deepseek-v4-flash',
    defaultEndpoint: 'https://api.deepseek.com/chat/completions',
    envKey: 'DEEPSEEK_API_KEY',
    envModel: 'DEEPSEEK_MODEL',
    envEndpoint: 'DEEPSEEK_ENDPOINT'
  },
  minimax: {
    defaultModel: 'MiniMax-M3',
    defaultEndpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    envKey: 'MINIMAX_API_KEY',
    envModel: 'MINIMAX_MODEL',
    envEndpoint: 'MINIMAX_ENDPOINT'
  },
  glm: {
    defaultModel: 'glm-4.5',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    envKey: 'GLM_API_KEY',
    envModel: 'GLM_MODEL',
    envEndpoint: 'GLM_ENDPOINT'
  }
}

export function resolveProvider(env, requested) {
  const def = (env.DEFAULT_PROVIDER || 'deepseek').toLowerCase()
  const key = (requested || def).toLowerCase()
  if (!PROVIDERS[key]) {
    throw new Error(`Unknown provider: ${requested}`)
  }
  const p = PROVIDERS[key]
  const apiKey = env[p.envKey]
  if (!apiKey) {
    throw new Error(`Missing env: ${p.envKey}`)
  }
  return {
    name: key,
    model: env[p.envModel] || p.defaultModel,
    endpoint: env[p.envEndpoint] || p.defaultEndpoint,
    apiKey
  }
}

export async function callProvider(provider, { system, user, temperature = 0.2 }) {
  const body = {
    model: provider.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature,
    stream: false
  }
  const res = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Provider ${provider.name} ${res.status}: ${text.slice(0, 400)}`)
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Provider ${provider.name} returned non-JSON: ${text.slice(0, 200)}`)
  }

  // MiniMax 即使 HTTP 200 也可能用 base_resp 返回业务错误（鉴权失败 / 余额不足等），
  // 此时 choices 为 null。先把真正的错误码暴露出来，便于排查。
  const baseResp = parsed?.base_resp
  if (baseResp && typeof baseResp.status_code === 'number' && baseResp.status_code !== 0) {
    throw new Error(`Provider ${provider.name} 业务错误 ${baseResp.status_code}: ${baseResp.status_msg || 'unknown'}`)
  }

  // 兼容 OpenAI 风格 / MiniMax 旧风格
  const content =
    parsed?.choices?.[0]?.message?.content ??
    parsed?.choices?.[0]?.text ??
    parsed?.reply ??
    null

  if (!content) {
    throw new Error(`Provider ${provider.name} returned empty content. Raw: ${text.slice(0, 500)}`)
  }

  const usage = parsed?.usage || {}
  return {
    content,
    provider: provider.name,
    model: provider.model,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? usage.total_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null
    }
  }
}

export function isAdmin(request, env) {
  const token = request.headers.get('x-admin-token')
  if (!token || !env.ADMIN_TOKEN) return false
  return token === env.ADMIN_TOKEN
}
