/**
 * POST /api/ai-assessment
 *
 * 输入 body: { patient, calculated, locale }
 * 可选 header:
 *   - x-admin-token: 管理员令牌（匹配 ADMIN_TOKEN env 才生效）
 *   - x-provider:    "minimax" | "glm" —— 仅在 x-admin-token 校验通过时生效，
 *                    普通用户的该 header 会被忽略，强制使用 DEFAULT_PROVIDER。
 *
 * 输出: { narrative, provider, model, usage }
 *      或 { error, message }
 */
import { buildSystemPrompt, buildUserMessage } from '../_lib/skill-prompt.js'
import { resolveProvider, callProvider, isAdmin } from '../_lib/providers.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, x-provider'
}

export function onRequestOptions() {
  return new Response(null, { headers: CORS })
}

export async function onRequestPost(context) {
  const { request, env } = context

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON' }, 400)
  }

  const { patient, calculated, locale, turnstileToken } = body || {}
  if (!patient || !calculated) {
    return json({ error: 'bad_request', message: 'patient and calculated required' }, 400)
  }

  const zh = locale !== 'en-US'
  const admin = isAdmin(request, env)
  const ip = request.headers.get('CF-Connecting-IP') || ''

  // 1) 人机验证（Turnstile）：管理员豁免；未配置 secret 时跳过（便于本地开发）
  if (!admin) {
    const ts = await verifyTurnstile(env, turnstileToken, ip)
    if (!ts.ok) {
      return json({
        error: 'verification_failed',
        message: zh ? '人机验证未通过，请重新验证后再试。' : 'Human verification failed. Please retry.'
      }, 403)
    }
  }

  // 2) 限流（每 IP 每天 N 次）：管理员豁免；未绑定 KV 时跳过
  if (!admin) {
    const rl = await checkRateLimit(env, ip)
    if (!rl.ok) {
      return json({
        error: 'rate_limited',
        message: zh
          ? `已达到每日使用上限（${rl.limit} 次/天），请明天再试。`
          : `Daily limit reached (${rl.limit}/day). Please try again tomorrow.`
      }, 429)
    }
  }

  // provider 解析：只有管理员可以指定，否则忽略 x-provider header
  const requested = admin ? request.headers.get('x-provider') : null

  let provider
  try {
    provider = resolveProvider(env, requested)
  } catch (e) {
    return json({ error: 'provider_error', message: e.message }, 500)
  }

  const system = buildSystemPrompt(locale)
  const user = buildUserMessage({ patient, calculated, locale })

  try {
    const result = await callProvider(provider, { system, user, temperature: 0.2 })
    return json({
      narrative: result.content,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      admin
    })
  } catch (e) {
    return json({
      error: 'upstream_error',
      message: e.message,
      provider: provider.name
    }, 502)
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

/**
 * Cloudflare Turnstile 校验。
 * 未配置 TURNSTILE_SECRET 时返回 ok=true（跳过），方便本地 wrangler pages dev。
 * 一旦在生产设置了该 secret，没有有效 token 的请求会被拒绝。
 */
async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET
  if (!secret) return { ok: true, skipped: true }
  if (!token) return { ok: false, reason: 'missing_token' }

  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    })
    const data = await res.json()
    return { ok: !!data.success, reason: (data['error-codes'] || []).join(',') }
  } catch {
    // 校验服务异常时保守拒绝，避免被绕过
    return { ok: false, reason: 'verify_unreachable' }
  }
}

/**
 * 每 IP 每天调用上限。依赖 KV 绑定 RATE_LIMIT_KV。
 * 未绑定 KV 时返回 ok=true（跳过）。上限可用 RATE_LIMIT_PER_DAY env 覆盖（默认 20）。
 */
async function checkRateLimit(env, ip) {
  const kv = env.RATE_LIMIT_KV
  if (!kv) return { ok: true, skipped: true }

  const limit = +(env.RATE_LIMIT_PER_DAY || 20)
  const day = new Date().toISOString().slice(0, 10)
  const key = `rl:${day}:${ip || 'unknown'}`

  const current = +(await kv.get(key)) || 0
  if (current >= limit) return { ok: false, current, limit }

  // 非原子递增；对防滥用场景足够。TTL 设 24h 自动清理。
  await kv.put(key, String(current + 1), { expirationTtl: 86400 })
  return { ok: true, current: current + 1, limit }
}
