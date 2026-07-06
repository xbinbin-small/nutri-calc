# CLAUDE.md

Guidance for Claude Code when working in this repository. Detailed area-specific conventions live in `.claude/rules/`.

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
- Hosting: Cloudflare Pages; production at `https://nutri-calc.pages.dev`. **Two custom domains both serve the same app**: `https://nutri.125261.xyz` (the **canonical** host — used in all `canonical`/`og:url`/sitemap, see `useSeo.js` `SITE_ORIGIN`) and the apex `https://125261.xyz`. The apex is a Pages custom domain (NOT a redirect) specifically so Google AdSense can verify the root domain — see Monetization below. Don't reintroduce an apex→subdomain redirect; AdSense verification fetches `125261.xyz` directly and needs real HTML there.

### Data files (`src/data/`)

| File | Purpose |
|---|---|
| `foods.json` | Regular foods, per-100g nutrients (common reference values) |
| `fsmp.json` | **Real FSMP product data** sourced from labels / manuals (Abbott, Nutricia, ...). Each entry has `source`, `registration_no`, `regulatory_category`, `market`. Schema details in `.claude/rules/fsmp-data.md`. |
| `conditions.json` | Disease categories — FSMP `indications` IDs must exist here |
| `dri.json` | DRI reference values (RDA, AMDR) |

### Routes (`src/views/`)

| Route | Component | Purpose |
|---|---|---|
| `/` | `Calculator.vue` | Food + FSMP picker, nutrient roll-up. Shows `FeaturedArticles` at bottom. |
| `/assessment` | `Assessment.vue` | Clinical assessment + AI deep-dive (the big page) |
| `/daily` | `DailyNeeds.vue` | BMR/TDEE + DRI targets |
| `/fsmp` | `FsmpLibrary.vue` | Browse FSMP by disease |
| `/articles` | `Articles.vue` | Markdown-based article list (SEO content). Labeled "营养小贴士 / Tips" in nav (**first** position). |
| `/articles/:slug` | `Article.vue` | Individual article, rendered from `src/articles/<slug>/<locale>.md`. Sets per-article SEO head via `setSeo()` (title/canonical/description). |
| `/about` | `About.vue` | About — **E-E-A-T content** (mission, editorial principles, sources/standards, tools, contact). Rewritten away from developer docs for AdSense trust; **don't revert** to the old tech-stack / JSON-file-listing copy. Content in `locales/*.json` `about.*`. |
| `/privacy`, `/terms`, `/disclaimer`, `/contact` | `Privacy.vue` etc. | Legal pages (footer-linked). Content authored in `locales/*.json` and read via `useLegalPage()` composable (bypassing `tm/rt` which is unreliable for nested object arrays) |

### Key modules

- `src/composables/useAssessment.js` — pure clinical logic (BMI, GLIM, NRS-2002, energy/protein, lab interpretation, PES). No I/O.
- `src/composables/useAiAssessment.js` — fetch wrapper for the Function + a custom (lightweight) Markdown renderer (`renderMarkdown` is exported and reused by articles)
- `src/composables/useCalcStore.js` — module-level reactive singleton (no Pinia), persists to `localStorage['nutri.calc.items.v1']`
- `src/composables/useArticles.js` — loads articles via Vite `import.meta.glob` (raw markdown); exposes index + featured + single-article helpers
- `src/composables/useLegalPage.js` — direct JSON import for Privacy/Terms/Disclaimer/Contact (bypasses `tm/rt` unreliability for nested object arrays)
- `src/components/CookieConsent.vue` — bottom banner shown once, dismissal persists in `localStorage['nutri.cookie.consent.v1']`
- `src/components/FeaturedArticles.vue` — homepage card section rendered at the bottom of `Calculator.vue`. Its heading is `featured_articles.title` = "精选小贴士 / Featured Tips" — intentionally **different** from the nav label "营养小贴士 / Tips" to avoid duplicate-name confusion; don't rename it back.
- `src/composables/useSeo.js` — per-route SEO head: `setSeo({title, description, path})` updates `<title>`, `canonical`, `description`, `og:*`. Exports `SITE_ORIGIN` (canonical host `https://nutri.125261.xyz`). Wired from `App.vue` (static routes) + `Article.vue` (articles).
- `src/composables/useAdsense.js` — AdSense loader, env-gated by `VITE_ADSENSE_CLIENT`. Lazy-injects `adsbygoogle.js` once; `App.vue` calls `ensureAdsenseScript()` only on content pages (see Monetization).
- `src/components/AdSlot.vue` — renders a real AdSense `<ins>` when client+`slotId` are set; otherwise a dev-only placeholder (nothing in prod).
- `src/components/SupportMe.vue` — donation widget (Buy Me a Coffee / Afdian / WeChat+Alipay QR), each channel env-gated and auto-hidden when unset. Used in footer (`variant="link"`) + article bottom (`variant="card"`).
- `src/components/ToolContent.vue` — crawlable explainer block (intro / methodology-basis / how-to-use / FAQ / disclaimer) rendered **below the tool widgets** on `/`, `/assessment`, `/daily`, `/fsmp`. Content comes from `<ns>.about` in the locale files via direct JSON import (same `tm/rt`-avoidance pattern as `useLegalPage`). Added so crawlers/AdSense see substantial content on tool pages instead of "thin" widgets (see Monetization → low-value-content) — **don't strip it**.
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

**Build-time (Vite)** — in `.env` (gitignored; tracked template `.env.example`). All public, baked into the bundle by `npm run build`:
- `VITE_TURNSTILE_SITE_KEY` — Turnstile site key
- `VITE_ADSENSE_CLIENT` — AdSense `ca-pub-…` (empty = no ads); `VITE_ADSENSE_SLOT_RAIL` / `VITE_ADSENSE_SLOT_INLINE` — ad unit IDs (filled after approval)
- `VITE_BMC_USERNAME` / `VITE_AFDIAN_URL` / `VITE_DONATE_QR` — donation channels (see Monetization)

⚠️ The Turnstile site key (frontend) and secret (backend) must be configured **together**. Setting only the secret will break the AI feature with 403 for all non-admin users.

### i18n

All UI strings go through `t()`. New keys must be added to **both** `src/locales/zh-CN.json` and `src/locales/en-US.json`. Locale persists in `localStorage['nutri.locale']` (default `zh-CN`).

For deeply nested object arrays (e.g., legal page sections), avoid `tm/rt` — use direct JSON import + `computed`. See `useLegalPage.js`.

### Articles workflow (SEO content)

~23 articles, **all bilingual** (zh-CN + en-US). They are the site's main SEO / AdSense content surface — keep growing them and keep the quality bar.

To add a science / education article (auto-listed on `/articles`, surfaces on homepage):

1. Create `src/articles/<slug>/zh-CN.md` (required) **and `en-US.md`** (do both — English mode falls back to the Chinese body, but full EN is preferred). Start with a paragraph, then `## h2` sections — **don't put `# h1`** in the markdown (Article.vue renders the title as `<h1>` from metadata).
2. Add a metadata entry to `src/articles/index.json` (**newest first**): `{ slug, date, tags, title_zh, title_en, summary_zh, summary_en }`. English fields fall back to Chinese if missing.
3. `npm run build && npx wrangler pages deploy dist --project-name nutri-calc`. The `prebuild` step regenerates the sitemap to include the new slug.

**Style (human voice — match existing articles, don't regress to an "AI template"):**
- Open with a real-life scenario / common-misconception hook, not a dictionary definition.
- **Vary structure between articles**: mix an optional `## 先说结论` bullet summary, a comparison/swap **table**, a `## 常见问题` FAQ, numbered steps, and a one-day example — not the same skeleton every time.
- **Never** use exam-note headings like `## 关键一 / 关键二` (the source notes had these; they were all stripped once — don't reintroduce). Use descriptive section headings.
- End with `## 小结` + `## 参考资料`.

**References & sourcing:**
- Cite only verifiable **public** sources (guideline name, national NHC / CDC, WHO). **Never** keep private-note citations like `本站笔记: 营养学/xxx.md` — strip them; they're unreachable internal paths.
- `renderMarkdown` does **not** support inline links `[text](url)` — write reference URLs as **plain text**.
- Article drafts + a dedup ledger live in the repo's `文章/营养科普文章/` workspace (`发布台账.md` is the index, **not** an article). That folder is the authoring source, not bundled into the app.

Articles are loaded via Vite's `import.meta.glob` with `?raw` query in `useArticles.js` — bundled at build time, no runtime fetch. Markdown rendering reuses `renderMarkdown` from `useAiAssessment.js`.

### Routing & SEO (history mode)

Migrated from hash routing to **history mode** for SEO / AdSense crawlability (clean URLs like `/articles/x`, no `#`). Invariants — breaking any of these regresses SEO or white-screens deep paths:

- `src/main.js`: `createWebHistory(import.meta.env.BASE_URL)`. Top of the file has a **legacy-hash redirect shim** that rewrites old `/#/x` URLs to `/x` (preserves query). Keep it — old shared/indexed links rely on it.
- `vite.config.js`: **`base: '/'`** (absolute). If reverted to `'./'`, deep paths load `./assets/...` relative to the path → 404 white screen.
- SPA fallback is required and already configured in `public/_redirects` (`/* /index.html 200`), `netlify.toml`, `vercel.json`. Cloudflare Pages Functions (`/api/*`) take precedence over the fallback, so the AI endpoint is unaffected.
- Per-route SEO via `useSeo.js` (see Key modules). Sitemap is generated at build time by `scripts/gen-sitemap.mjs` (wired as npm `prebuild`, reads `src/articles/index.json` + static routes → `public/sitemap.xml`), so new articles auto-appear. `public/robots.txt` points to it.
- More detail in `.claude/rules/ui-vue.md`.

### Monetization (AdSense + donations)

Env-gated. **Donations** stay dormant until configured (empty vars = hidden buttons). **AdSense** is configured and the site is **submitted for review**: the verification meta tag + real `ads.txt` are live and `VITE_ADSENSE_CLIENT` is set, but ad **units** aren't placed yet (slot vars empty → no `<ins>` renders), so production currently shows **no ads**.

- **AdSense**: publisher ID `ca-pub-5627846461515398` (live in `.env` `VITE_ADSENSE_CLIENT`). Verified at the **root domain** `125261.xyz` (AdSense requires a top-level domain and verifies the submitted host directly — hence the apex serves the app, see Architecture). Verification uses the `<meta name="google-adsense-account">` tag in `index.html` (a marker, loads nothing — safe site-wide). `public/ads.txt` carries `google.com, pub-5627846461515398, DIRECT, ...`.
- **"Low value content" learning**: AdSense first held approval as *low value content* — typical for tool-heavy SPAs whose tool pages are thin to crawlers. Addressed by: growing to ~23 bilingual articles, rewriting `About.vue` for E-E-A-T, and adding crawlable `ToolContent.vue` explainer text to `/`, `/assessment`, `/daily`, `/fsmp`. **Keep this content; don't regress tool pages back to bare widgets** or it can relapse.
- **Ad placement is restricted to content pages only** — `AD_PAGES = ['calculator','articles','article','about']` in `App.vue`. Ads (and the `adsbygoogle.js` script) **must never load on `/assessment`, `/daily`, `/fsmp`** or legal pages. This is a privacy commitment in the cookie banner + privacy policy copy ("评估页不加载任何广告/第三方脚本"); the gating in `App.vue`/`AdSlot.vue` enforces it. (Adding `ToolContent` text to those pages is fine — it's content, not ads.) Don't relax the ad gating.
- **To go live after AdSense approval**: create ad units → put their slot IDs in `.env` (`VITE_ADSENSE_SLOT_RAIL`, `VITE_ADSENSE_SLOT_INLINE`) → rebuild + deploy. (`VITE_ADSENSE_CLIENT` is already set.)
- **Donations**: `SupportMe.vue`, gated by `VITE_BMC_USERNAME` (Buy Me a Coffee, intl cards), `VITE_AFDIAN_URL` (爱发电, mainland), `VITE_DONATE_QR=1` (WeChat/Alipay QR — needs `public/donate-wechat.png` + `donate-alipay.png`). Donations ≠ charging for medical content (lower regulatory risk), but keep them unbundled from the AI feature — see `clinical-content.md` charging caution.

### Deployment & deploy URLs

- Production: `https://nutri-calc.pages.dev` (custom domains `nutri.125261.xyz` canonical + apex `125261.xyz`)
- Preview deploys: each `wrangler pages deploy` returns a unique `https://<hash>.nutri-calc.pages.dev` URL
- ⚠️ Preview deploys have a **separate** environment from production — secrets set without `--env preview` are not visible there, so AI features fail on preview URLs. Test on production URL.

## Detailed conventions

Loaded contextually from `.claude/rules/`:
- `clinical-content.md` — clinical / medical safety rules (always loaded)
- `cloudflare-functions.md` — backend invariants (when editing `functions/`)
- `ui-vue.md` — Vue + i18n + state conventions (when editing `src/views/` or `src/components/`)
- `fsmp-data.md` — FSMP product entry schema (when editing `src/data/fsmp.json`)
