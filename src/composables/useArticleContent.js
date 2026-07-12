/**
 * 文章正文加载器（与 useArticles.js 的元数据部分刻意分离）。
 *
 * 这里的 Vite glob 会把全部 markdown（~260KB）作为字符串打进本模块所在的 chunk。
 * 只有文章详情视图（Article.vue，路由懒加载）import 本文件——首页/列表页
 * 只依赖 useArticles.js（仅 index.json）。若把两者合并回一个文件，
 * 首页 chunk 会重新背上所有正文，性能立刻回退。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import index from '../articles/index.json'
import { localized } from './useArticles.js'

// Vite glob: 把所有 markdown 内容作为字符串引入打包
const contentModules = import.meta.glob('../articles/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
})

// 构建查表：{ slug: { 'zh-CN': '...', 'en-US': '...' } }
const contentMap = {}
for (const path in contentModules) {
  const m = path.match(/\/articles\/([^/]+)\/([a-z]{2}-[A-Z]{2})\.md$/)
  if (!m) continue
  const [, slug, locale] = m
  if (!contentMap[slug]) contentMap[slug] = {}
  contentMap[slug][locale] = contentModules[path]
}

/** 单篇文章 + 正文内容。 */
export function useArticle(slug) {
  const { locale } = useI18n()
  return computed(() => {
    const meta = index.find((a) => a.slug === slug)
    if (!meta) return null
    const localeKey = locale.value
    const fallback  = 'zh-CN'
    const map = contentMap[slug] || {}
    const content = map[localeKey] || map[fallback] || ''
    return {
      slug,
      date: meta.date,
      tags: meta.tags || [],
      ...localized(meta, localeKey),
      content,
      hasCurrentLocale: !!map[localeKey],
      fallbackUsed: !map[localeKey] && !!map[fallback]
    }
  })
}
