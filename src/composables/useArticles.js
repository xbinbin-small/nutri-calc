/**
 * 科普文章（Markdown）加载器。
 *
 * 文件组织：
 *   src/articles/
 *     index.json                       元信息（标题、日期、摘要、tags）
 *     <slug>/zh-CN.md                  中文正文
 *     <slug>/en-US.md                  英文正文（可选，缺失时回退到 zh-CN）
 *
 * 添加新文章的工作流：
 *   1) 在 src/articles/<新 slug>/ 下放 zh-CN.md（必填）和 en-US.md（可选）
 *   2) 在 src/articles/index.json 增加一条记录
 *   3) npm run build && wrangler pages deploy dist
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import index from '../articles/index.json'

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

function localized(meta, locale) {
  const lang = locale === 'en-US' ? 'en' : 'zh'
  return {
    title:   meta[`title_${lang}`]   || meta.title_zh,
    summary: meta[`summary_${lang}`] || meta.summary_zh
  }
}

/** 文章列表，按日期倒序。 */
export function useArticleIndex() {
  const { locale } = useI18n()
  return computed(() =>
    [...index]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({
        slug: item.slug,
        date: item.date,
        tags: item.tags || [],
        ...localized(item, locale.value)
      }))
  )
}

/** 最新 N 篇（用于首页）。 */
export function useFeaturedArticles(limit = 3) {
  const list = useArticleIndex()
  return computed(() => list.value.slice(0, limit))
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
