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

// 注意：本文件只依赖 index.json（元数据），刻意不 import 文章正文。
// 正文的 Vite glob 在 useArticleContent.js —— 它只被文章详情路由（懒加载）引用，
// 这样首页/列表页的 chunk 不会背上全部 markdown（~260KB）。别把 glob 挪回来。

export function localized(meta, locale) {
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
