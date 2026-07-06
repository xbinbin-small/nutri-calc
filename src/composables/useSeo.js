/**
 * 轻量 SEO 头信息管理 / Lightweight per-route SEO head manager.
 *
 * 手写、零依赖（遵守 ui-vue.md 的无框架膨胀约束）。SPA 无 SSR，但 Googlebot 会执行
 * JS 并读取动态写入的 <title> / canonical / meta，足以满足收录与 AdSense 审核。
 */

// 规范域（自定义域为准）。canonical / og:url 都以此为前缀。
export const SITE_ORIGIN = 'https://nutri.125261.xyz'
const SITE_NAME = 'NutriCalc · 营养素计算器'

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function upsertLink(rel) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  return el
}

/**
 * 设置当前页面的 SEO 头信息。
 * @param {{title?: string, description?: string, path?: string}} opts
 *   path 形如 '/articles/glim-intro'（不含域名 / hash / query）。
 */
export function setSeo({ title, description, path } = {}) {
  const fullTitle = title ? `${title} · NutriCalc` : SITE_NAME
  document.title = fullTitle

  const url = SITE_ORIGIN + (path || '/')

  upsertLink('canonical').setAttribute('href', url)

  if (description) {
    upsertMeta('meta[name="description"]', { name: 'description', content: description })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  }
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
}
