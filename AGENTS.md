# AGENTS.md

Guidance for Codex when working in this repository. Detailed area-specific conventions live in `.Codex/rules/`.

## Commands

- `npm install` — install (Node 18+)
- `npm run dev` — Vite dev server at http://127.0.0.1:5173 (frontend only; AI button errors because Functions aren't running)
- `npm run build` — production build → `dist/`
- `npx wrangler pages dev dist --port 8788` — full local stack including Functions (needs `.dev.vars`)
- `npx wrangler pages deploy dist --project-name nutri-calc` — deploy to Cloudflare Pages

No test runner. Verify changes by exercising the UI.

## Architecture

**Static SPA + single serverless function.**

- Frontend: Vue 3 (Composition API / `<script setup>`) + Vite 6 + Vue Router 4 (history mode) + Vue I18n 10
- Backend: one Cloudflare Pages Function at `functions/api/ai-assessment.js` (POST `/api/ai-assessment`)
- Hosting: Cloudflare Pages; production at `https://nutri-calc.pages.dev`, custom domain `https://nutri.125261.xyz`

### Data files (`src/data/`)

| File | Purpose |
|---|---|
| `foods.json` | Regular foods, per-100g nutrients |
| `fsmp.json` | Special Medical Food / enteral nutrition entries (source-tracked product label data) |
| `conditions.json` | Disease categories — FSMP `indications` IDs must exist here |
| `dri.json` | DRI reference values (RDA, AMDR) |

### Routes (`src/views/`)

| Route | Component | Purpose |
|---|---|---|
| `/` | `Calculator.vue` | Food + FSMP picker, nutrient roll-up. Shows `FeaturedArticles` at bottom. |
| `/assessment` | `Assessment.vue` | Clinical assessment + AI deep-dive (the big page) |
| `/daily` | `DailyNeeds.vue` | BMR/TDEE + DRI targets |
| `/fsmp` | `FsmpLibrary.vue` | Browse FSMP by disease |
| `/articles` | `Articles.vue` | Markdown-based article list (SEO content) |
| `/articles/:slug` | `Article.vue` | Individual article, rendered from `src/articles/<slug>/<locale>.md` |
| `/about` | `About.vue` | About |
| `/privacy`, `/terms`, `/disclaimer`, `/contact` | `Privacy.vue` etc. | Legal pages (footer-linked). Content authored in `locales/*.json` and read via `useLegalPage()` composable (bypassing `tm/rt` which is unreliable for nested object arrays) |

### Key modules

- `src/composables/useAssessment.js` — pure clinical logic (BMI, GLIM, NRS-2002, energy/protein, lab interpretation, PES). No I/O.
- `src/composables/useAiAssessment.js` — fetch wrapper for the Function + a custom (lightweight) Markdown renderer
- `src/composables/useCalcStore.js` — module-level reactive singleton (no Pinia), persists to `localStorage['nutri.calc.items.v1']`
- `functions/_lib/providers.js` — LLM provider abstraction (DeepSeek default, MiniMax, GLM)
- `functions/_lib/skill-prompt.js` — system prompt + user-message builder for the clinical AI report

### AI request pipeline

1. User fills assessment → `useAssessment.js` runs deterministic rules in-browser → rule-based report renders
2. User clicks "Generate AI" → frontend POSTs `{ patient, calculated, locale, turnstileToken }` to `/api/ai-assessment`
3. Function: **Turnstile check → rate-limit check → resolve provider → call LLM** → returns Markdown narrative
4. Frontend renders narrative via `renderMarkdown()` in `useAiAssessment.js`

### LLM providers

Three OpenAI-style chat-completions providers. Default is **DeepSeek**.

| Provider | Default model | Endpoint |
|---|---|---|
| `deepseek` (default) | `deepseek-v4-flash` | `api.deepseek.com/chat/completions` |
| `minimax` | `MiniMax-M3` | `api.minimax.chat/v1/text/chatcompletion_v2` |
| `glm` | `glm-4.5` | `open.bigmodel.cn/api/paas/v4/chat/completions` |

Switch the default permanently via `wrangler.toml` `DEFAULT_PROVIDER`; switch per-session via the admin panel.

### Abuse protection (active in production)

- **Cloudflare Turnstile**: frontend renders widget when `VITE_TURNSTILE_SITE_KEY` is set at build time; backend verifies via `TURNSTILE_SECRET`. Admins bypass.
- **Per-IP daily rate limit**: KV-backed (`RATE_LIMIT_KV` binding), default `RATE_LIMIT_PER_DAY=20`. Admins bypass.
- Both gracefully skip if not configured (so `wrangler pages dev` works without setup).

### Admin panel

Open `https://<domain>/assessment?admin=1` → scroll to bottom.

- Token + provider choice saved in `localStorage` (`nutri.admin.v1`, `nutri.admin.provider`)
- Backend compares `x-admin-token` with `env.ADMIN_TOKEN`; only matching requests accept the `x-provider` header

> Historical note: original trigger was `#admin`, but it collided with Vue Router's old hash mode. The router is now history mode (no `#`); the query-string trigger `?admin=1` (read from `window.location.search`) remains the way in — don't reintroduce a hash-based trigger.

### Environment variables (Cloudflare Pages)

**Secrets** — inject via `npx wrangler pages secret put NAME --project-name nutri-calc`:
- `DEEPSEEK_API_KEY`, `MINIMAX_API_KEY`, `GLM_API_KEY` — provider keys
- `ADMIN_TOKEN` — admin panel auth
- `TURNSTILE_SECRET` — backend Turnstile verification

**Public vars** — in `wrangler.toml [vars]`:
- `DEFAULT_PROVIDER`, `<PROVIDER>_MODEL`, `<PROVIDER>_ENDPOINT`, `RATE_LIMIT_PER_DAY`

**Build-time (Vite)** — in `.env` (gitignored):
- `VITE_TURNSTILE_SITE_KEY` — Turnstile site key (public, baked into JS bundle by `npm run build`)

⚠️ The Turnstile site key (frontend) and secret (backend) must be configured **together**. Setting only the secret will break the AI feature with 403 for all non-admin users.

### i18n

All UI strings go through `t()`. New keys must be added to **both** `src/locales/zh-CN.json` and `src/locales/en-US.json`. Locale persists in `localStorage['nutri.locale']` (default `zh-CN`).

For deeply nested object arrays (e.g., legal page sections), avoid `tm/rt` — use direct JSON import + `computed`. See `useLegalPage.js`.

### Articles workflow (SEO content)

To add a science / education article (auto-listed on `/articles` and surfaces on homepage):

1. Create `src/articles/<slug>/zh-CN.md` (required) and optionally `en-US.md`. Start with a paragraph, then `## h2` sections — **don't put `# h1`** in the markdown (Article.vue renders the title as `<h1>` from metadata).
2. Add a metadata entry to `src/articles/index.json`: `{ slug, date, tags, title_zh, title_en, summary_zh, summary_en }`. English fields fall back to Chinese if missing.
3. `npm run build && npx wrangler pages deploy dist --project-name nutri-calc`.

Articles are loaded via Vite's `import.meta.glob` with `?raw` query in `useArticles.js` — content is bundled at build time, no runtime fetch. Markdown rendering reuses `renderMarkdown` from `useAiAssessment.js`.

### Deployment & deploy URLs

- Production: `https://nutri-calc.pages.dev` (custom domain `nutri.125261.xyz`)
- Preview deploys: each `wrangler pages deploy` returns a unique `https://<hash>.nutri-calc.pages.dev` URL
- ⚠️ Preview deploys have a **separate** environment from production — secrets set without `--env preview` are not visible there, so AI features fail on preview URLs. Test on production URL.

## Detailed conventions

Loaded contextually from `.Codex/rules/`:
- `clinical-content.md` — clinical / medical safety rules (always loaded)
- `cloudflare-functions.md` — backend invariants (when editing `functions/`)
- `ui-vue.md` — Vue + i18n + state conventions (when editing `src/views/` or `src/components/`)
