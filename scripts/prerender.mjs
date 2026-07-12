/**
 * 构建期预渲染 / Build-time prerender (postbuild).
 *
 * 背景：站点是纯客户端 SPA，所有 URL 原本都返回同一份空壳 index.html
 * （无正文、canonical 全部指向首页）——这是 AdSense「低价值内容」判定的根因。
 *
 * 本脚本在 `vite build` 之后运行，为 sitemap 里的每个 URL 生成真实的静态 HTML：
 *   - 各自正确的 <title> / description / canonical / og:*（与 useSeo.js 运行时行为一致）
 *   - 完整可抓取的正文（文章 Markdown、工具页说明、关于/法律页文案）
 *   - JSON-LD 结构化数据（Article / FAQPage / WebSite / ItemList）
 *
 * Cloudflare Pages 静态文件优先于 `/* /index.html 200` 回退，因此 SPA 行为不变：
 * Vue 挂载到 #app 后照常接管页面。预渲染内容使用 zh-CN（站点默认语言）。
 *
 * 数据来源与运行时同源：src/articles/*、src/locales/zh-CN.json、
 * renderMarkdown 直接复用 useAiAssessment.js 的实现，避免两套渲染逻辑漂移。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { renderMarkdown } from '../src/composables/useAiAssessment.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')

const ORIGIN = 'https://nutri.125261.xyz'
const SITE_NAME = 'NutriCalc · 营养素计算器'

const zh = JSON.parse(readFileSync(resolve(root, 'src/locales/zh-CN.json'), 'utf8'))
const articles = JSON.parse(readFileSync(resolve(root, 'src/articles/index.json'), 'utf8'))
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date))

const template = readFileSync(resolve(dist, 'index.html'), 'utf8')
if (!template.includes('<div id="app"></div>')) {
  throw new Error('[prerender] dist/index.html 缺少 <div id="app"></div> 挂载点，模板结构变了？')
}

/* ---------- helpers ---------- */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// JSON-LD 需防止 </script> 提前闭合
const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

const ul = (items) => `<ul>${(items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
const ol = (items) => `<ol>${(items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`

/** 与 App.vue 相同的页面骨架（静态 <a> 版），保证爬虫可见的站内链接 */
function shell(contentHtml) {
  const nav = [
    ['/articles', zh.nav.articles],
    ['/', zh.nav.calculator],
    ['/assessment', zh.nav.assessment],
    ['/daily', zh.nav.daily_needs],
    ['/fsmp', zh.nav.fsmp],
    ['/about', zh.nav.about]
  ]
  const footer = [
    ['/privacy', zh.footer_links.privacy],
    ['/terms', zh.footer_links.terms],
    ['/disclaimer', zh.footer_links.disclaimer],
    ['/contact', zh.footer_links.contact]
  ]
  return (
    `<header class="topbar"><div class="topbar-inner">` +
    `<a href="/" class="brand"><span class="logo">N</span><div>` +
    `<div class="name">${esc(zh.app.title)}</div><div class="tagline">${esc(zh.app.tagline)}</div>` +
    `</div></a>` +
    `<nav class="nav-links">${nav.map(([href, label]) => `<a class="nav-link" href="${href}">${esc(label)}</a>`).join('')}</nav>` +
    `</div></header>` +
    `<main class="page-layout"><div class="content">${contentHtml}</div></main>` +
    `<footer class="footer">` +
    `<nav class="footer-nav">${footer.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('<span class="footer-sep">·</span>')}</nav>` +
    `<div class="footer-copy">${esc(zh.app.footer.replace('{year}', String(new Date().getFullYear())))}</div>` +
    `</footer>`
  )
}

/**
 * 基于 dist/index.html 生成单页 HTML。
 * 替换逻辑与 useSeo.js 的运行时 upsert 一一对应，保证 JS 接管前后头信息一致。
 */
function renderPage({ path, title, description, body, ld = [], ogType = 'website' }) {
  const fullTitle = title ? `${title} · NutriCalc` : SITE_NAME
  const url = ORIGIN + path
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace(/<meta name="description"[^>]*\/?>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<link rel="canonical"[^>]*\/?>/, `<link rel="canonical" href="${esc(url)}" />`)
    .replace(/<meta property="og:title"[^>]*\/?>/, `<meta property="og:title" content="${esc(fullTitle)}" />`)
    .replace(/<meta property="og:description"[^>]*\/?>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="og:url"[^>]*\/?>/, `<meta property="og:url" content="${esc(url)}" />`)
    .replace(/<meta property="og:type"[^>]*\/?>/, `<meta property="og:type" content="${ogType}" />`)
  if (ld.length) html = html.replace('</head>', `    ${ld.map(jsonLd).join('\n    ')}\n  </head>`)
  html = html.replace('<div id="app"></div>', `<div id="app">${shell(body)}</div>`)
  return html
}

/**
 * 输出为 <path>.html 平铺文件（而非 <path>/index.html）：
 * Cloudflare Pages 对 `/foo` 会直接以 foo.html 响应 200；
 * 若用 foo/index.html 则会 308 到 `/foo/`，与 canonical/sitemap 的无斜杠 URL 相悖。
 */
function writePage(path, html) {
  const out = path === '/' ? resolve(dist, 'index.html') : resolve(dist, `${path.replace(/^\//, '')}.html`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html, 'utf8')
}

const publisher = {
  '@type': 'Organization',
  name: 'NutriCalc',
  url: ORIGIN
}
const author = {
  '@type': 'Organization',
  name: 'NutriCalc 编辑部',
  url: `${ORIGIN}/about`
}

/* ---------- 1) 文章页 ---------- */

const BYLINE =
  `<p class="article-byline muted">${esc(zh.articles.byline_author)} · ` +
  `<a href="/about">${esc(zh.articles.byline_about)}</a></p>`

for (const a of articles) {
  const mdPath = resolve(root, `src/articles/${a.slug}/zh-CN.md`)
  if (!existsSync(mdPath)) {
    console.warn(`[prerender] 缺少 ${a.slug}/zh-CN.md，跳过`)
    continue
  }
  const md = readFileSync(mdPath, 'utf8')
  const path = `/articles/${a.slug}`
  const tags = (a.tags || []).map((t) => `<span class="article-tag">${esc(t)}</span>`).join('')
  const body =
    `<article class="article-detail-page">` +
    `<a href="/articles" class="article-back">← ${esc(zh.articles.back_to_list)}</a>` +
    `<header class="article-detail-head"><h1>${esc(a.title_zh)}</h1>` +
    `<div class="article-meta"><span class="article-date">${esc(a.date)}</span>${tags}</div>` +
    BYLINE +
    `</header>` +
    `<div class="article-content md-body">${renderMarkdown(md)}</div>` +
    `</article>`
  writePage(path, renderPage({
    path,
    title: a.title_zh,
    description: a.summary_zh,
    body,
    ogType: 'article',
    ld: [{
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title_zh,
      description: a.summary_zh,
      datePublished: a.date,
      dateModified: a.date,
      inLanguage: 'zh-CN',
      mainEntityOfPage: ORIGIN + path,
      author,
      publisher
    }]
  }))
}

/* ---------- 2) 文章列表页 /articles ---------- */

{
  const items = articles.map((a) =>
    `<li><a href="/articles/${a.slug}">${esc(a.title_zh)}</a>` +
    `<span class="article-date"> · ${esc(a.date)}</span>` +
    `<p class="muted">${esc(a.summary_zh)}</p></li>`
  ).join('')
  const body =
    `<section><h1>${esc(zh.articles.list_title)}</h1>` +
    `<p class="muted">${esc(zh.articles.list_subtitle)}</p>` +
    `<ul class="article-static-list">${items}</ul></section>`
  writePage('/articles', renderPage({
    path: '/articles',
    title: zh.seo.articles.title,
    description: zh.seo.articles.desc,
    body,
    ld: [{
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: articles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: a.title_zh,
        url: `${ORIGIN}/articles/${a.slug}`
      }))
    }]
  }))
}

/* ---------- 3) 工具页（首页 / 评估 / 每日需求 / FSMP）---------- */

/** 复刻 ToolContent.vue 的说明区结构（intro / 方法依据 / 怎么用 / FAQ / 免责） */
function toolAboutHtml(ns) {
  const d = zh[ns]?.about
  if (!d) return ''
  return (
    `<section class="tool-about card"><h2>${esc(d.title)}</h2>` +
    (d.intro || []).map((p) => `<p class="muted">${esc(p)}</p>`).join('') +
    `<h3>${esc(d.basis_title)}</h3>${ul(d.basis)}` +
    `<h3>${esc(d.use_title)}</h3>${ol(d.use)}` +
    `<h3>${esc(d.faq_title)}</h3>` +
    (d.faq || []).map((f) => `<div class="tool-faq"><p class="tool-faq-q">${esc(f.q)}</p><p class="muted">${esc(f.a)}</p></div>`).join('') +
    (d.note ? `<p class="tool-about-note muted">${esc(d.note)}</p>` : '') +
    `</section>`
  )
}

const faqLd = (ns) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: (zh[ns]?.about?.faq || []).map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a }
  }))
})

// 首页：工具说明 + 最新文章入口（内链），覆盖 dist/index.html（同时是 SPA 回退模板）
{
  const featured = articles.slice(0, 5).map((a) =>
    `<li><a href="/articles/${a.slug}">${esc(a.title_zh)}</a><p class="muted">${esc(a.summary_zh)}</p></li>`
  ).join('')
  const body =
    `<section><h1>${esc(zh.seo.calculator.title)}</h1>` +
    `<p class="muted">${esc(zh.seo.calculator.desc)}</p></section>` +
    toolAboutHtml('calculator') +
    `<section class="card"><h2>${esc(zh.featured_articles?.title || zh.articles.list_title)}</h2>` +
    `<ul class="article-static-list">${featured}</ul>` +
    `<p><a href="/articles">${esc(zh.articles.back_to_list)}</a></p></section>`
  writePage('/', renderPage({
    path: '/',
    title: zh.seo.calculator.title,
    description: zh.seo.calculator.desc,
    body,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'NutriCalc',
        alternateName: SITE_NAME,
        url: ORIGIN,
        inLanguage: ['zh-CN', 'en-US']
      },
      faqLd('calculator')
    ]
  }))
}

for (const [ns, path] of [['assessment', '/assessment'], ['daily', '/daily'], ['fsmp', '/fsmp']]) {
  const body =
    `<section><h1>${esc(zh.seo[ns].title)}</h1><p class="muted">${esc(zh.seo[ns].desc)}</p></section>` +
    toolAboutHtml(ns)
  writePage(path, renderPage({
    path,
    title: zh.seo[ns].title,
    description: zh.seo[ns].desc,
    body,
    ld: [faqLd(ns)]
  }))
}

/* ---------- 4) 关于页 /about ---------- */

{
  const a = zh.about
  const section = (titleKey, bodies) =>
    `<h2>${esc(a[titleKey])}</h2>` +
    bodies.map((b) => (Array.isArray(b) ? ul(b) : `<p>${esc(b)}</p>`)).join('')
  const body =
    `<section class="card"><h1>${esc(a.title)}</h1><p>${esc(a.intro)}</p>` +
    section('mission_title', [a.mission]) +
    section('principles_title', [a.principles]) +
    section('sources_title', [a.sources_intro, a.sources]) +
    section('tools_title', [a.tools_intro, a.tools]) +
    section('data_title', [a.data_intro, a.data]) +
    section('review_title', [a.review]) +
    `<h2>${esc(a.privacy_title)}</h2><p>${esc(a.privacy)}<a href="/privacy">${esc(a.privacy_link)}</a>。</p>` +
    `</section>`
  writePage('/about', renderPage({
    path: '/about',
    title: zh.seo.about.title,
    description: zh.seo.about.desc,
    body
  }))
}

/* ---------- 5) 法律页 ---------- */

for (const [ns, path] of [['privacy', '/privacy'], ['terms', '/terms'], ['disclaimer', '/disclaimer'], ['contact', '/contact']]) {
  const d = zh[ns]
  const sections = (d.sections || []).map((s) =>
    `<h2>${esc(s.h)}</h2>` +
    (s.p ? `<p>${esc(s.p)}</p>` : '') +
    (s.ul ? ul(s.ul) : '') +
    (s.after ? `<p>${esc(s.after)}</p>` : '')
  ).join('')
  const body =
    `<section class="card"><h1>${esc(d.title)}</h1>` +
    (d.last_updated ? `<p class="muted">${esc(d.last_updated)}</p>` : '') +
    (d.intro ? `<p>${esc(d.intro)}</p>` : '') +
    sections + `</section>`
  writePage(path, renderPage({
    path,
    title: zh.seo[ns].title,
    description: zh.seo[ns].desc,
    body
  }))
}

/* ---------- 6) 404 页 ---------- */
// Cloudflare Pages 对未匹配路径原生返回 404.html + 404 状态（_redirects 已不设全局回退）。
// 去掉 canonical、加 noindex：404 页不该被收录。
{
  const nf = zh.notfound
  const body =
    `<section class="card" style="max-width:560px;margin:48px auto;text-align:center;padding:40px 24px">` +
    `<h1>${esc(nf.title)}</h1><p class="muted">${esc(nf.desc)}</p>` +
    `<p><a href="/">${esc(nf.home)}</a> · <a href="/articles">${esc(nf.articles)}</a></p></section>`
  let html = renderPage({ path: '/404', title: zh.seo.notfound.title, description: zh.seo.notfound.desc, body })
  html = html
    .replace(/<link rel="canonical"[^>]*\/?>\s*\n?/, '')
    .replace('</head>', `    <meta name="robots" content="noindex" />\n  </head>`)
  writeFileSync(resolve(dist, '404.html'), html, 'utf8')
}

console.log(`[prerender] 完成：${articles.length} 篇文章 + 10 个静态页 + 404 → dist/**/*.html`)
