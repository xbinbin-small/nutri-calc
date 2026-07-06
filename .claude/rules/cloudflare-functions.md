---
description: Invariants for Cloudflare Pages Functions in this project.
paths:
  - functions/**
---

# Cloudflare Functions 约束

## 两道安全门必须保留

`functions/api/ai-assessment.js` 在调用 LLM 之前必须依序执行：

1. **Turnstile 验证**（`verifyTurnstile`）— 验证 `body.turnstileToken`；未配置 `TURNSTILE_SECRET` 时跳过（本地开发友好）
2. **限流**（`checkRateLimit`）— KV 计数 `rl:<date>:<ip>`；未绑定 `RATE_LIMIT_KV` 时跳过
3. 然后 `resolveProvider` → `callProvider`

管理员（`isAdmin` 通过）豁免 1 和 2。

如果重构这个文件：
- **不要移除任何一道门**
- **不要倒换顺序**——Turnstile 必须在限流之前。倒换会导致失败的验证消耗限额名额
- **不要把这两个检查改成「always on」**（即去掉 graceful skip），否则会破坏 `wrangler pages dev` 本地开发体验

## Provider 抽象

新增 LLM provider 走以下流程：

1. 在 `functions/_lib/providers.js` 的 `PROVIDERS` 字典里添加一项（`defaultModel` / `defaultEndpoint` / `envKey` / `envModel` / `envEndpoint`）
2. 在 `wrangler.toml [vars]` 加默认 model 和 endpoint
3. 把 secret 通过 `npx wrangler pages secret put <NAME>` 注入。**绝不**写到代码或 `wrangler.toml`
4. 在 `src/views/Assessment.vue` 管理员面板 `<select>` 增加 `<option>`
5. 顶部注释里的"环境变量约定"块要同步更新

**目前所有 provider 都是 OpenAI 风格 chat completions**。若要引入 Anthropic 风格（如 Claude），需要扩展 `callProvider` 处理不同的请求体（`messages` 格式不同）和响应解析（content 在 `content[0].text` 而非 `choices[0].message.content`）。

## MiniMax 业务错误

MiniMax 即使 HTTP 200 也可能在 `base_resp.status_code != 0` 时返回业务错误（`choices: null`）。`callProvider` 已专门处理这种情况：在尝试提取 content 之前先检查 `base_resp`。**不要为「代码整洁」删掉这段检查**，删掉后所有 MiniMax 业务错误会被笼统报为 "empty content"，排查代价巨大（实际踩过这个坑）。

## CORS

所有响应（成功 / 错误）都必须走 `json()` 辅助函数，它附带 `CORS` headers。如果某个分支直接 `return new Response(...)` 漏了 CORS，浏览器会显示 `Failed to fetch`——这种错误的根因比真正的网络问题难诊断得多。

## 不要在 Function 里持久化患者数据

`body.patient` 含可识别临床信息。Function 只允许把它转发给 LLM 的 user message，**不能写入 KV / R2 / D1 / `console.log`**。详情见 `clinical-content.md`。

KV 的当前唯一用途是 `rl:<date>:<ip>` 限流计数器。新增其他 KV key 之前请先讨论。

## 环境隔离：production vs preview

`wrangler pages secret put` 默认只设置到 production 环境。Preview 环境（每次 `wrangler pages deploy` 生成的临时 URL）**没有任何 secret**——所以预览 URL 上的 AI 功能必然失败。

不要为了让预览 URL 也能用 AI 而把 secrets 也设置到 preview 环境（双倍管理成本，且容易泄漏）。预览 URL 应当只用于前端 UI 检查；后端功能在 production URL 测试。

## 不要把 Turnstile / 限流改成「软告警」

如果想要"先观察、不阻断"的灰度模式，加一个独立的 env flag（如 `ENFORCEMENT_MODE=observe`），不要修改现有 fail-closed 行为。这两道门是 AI API 成本失控的最后防线。
