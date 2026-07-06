/**
 * 构建期生成 sitemap.xml / Build-time sitemap generator.
 *
 * 读取 src/articles/index.json，结合静态路由，写出 public/sitemap.xml。
 * 由 package.json 的 "prebuild" 钩子在 `npm run build` 前自动执行，
 * 因此站点地图始终与文章列表同步。
 *
 * 站点双语共用同一 URL（locale 存 localStorage，不进 URL），故无需 hreflang。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const ORIGIN = 'https://nutri.125261.xyz'
const today = new Date().toISOString().slice(0, 10)

// 静态路由及其抓取优先级
const staticRoutes = [
  { path: '/',           priority: '1.0' },
  { path: '/articles',   priority: '0.8' },
  { path: '/fsmp',       priority: '0.7' },
  { path: '/daily',      priority: '0.6' },
  { path: '/assessment', priority: '0.6' },
  { path: '/about',      priority: '0.5' },
  { path: '/privacy',    priority: '0.3' },
  { path: '/terms',      priority: '0.3' },
  { path: '/disclaimer', priority: '0.3' },
  { path: '/contact',    priority: '0.3' }
]

const articles = JSON.parse(
  readFileSync(resolve(root, 'src/articles/index.json'), 'utf8')
)

const urls = [
  ...staticRoutes.map((r) => ({ loc: ORIGIN + r.path, lastmod: today, priority: r.priority })),
  ...articles.map((a) => ({
    loc: `${ORIGIN}/articles/${a.slug}`,
    lastmod: a.date || today,
    priority: '0.7'
  }))
]

const body = urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`

const out = resolve(root, 'public/sitemap.xml')
writeFileSync(out, xml, 'utf8')
console.log(`[gen-sitemap] wrote ${urls.length} URLs → public/sitemap.xml`)
