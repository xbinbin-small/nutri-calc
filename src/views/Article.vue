<script setup>
import { computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useArticle } from '../composables/useArticleContent.js'
import { renderMarkdown } from '../composables/useAiAssessment.js'
import { setSeo } from '../composables/useSeo.js'
import AdSlot from '../components/AdSlot.vue'
import SupportMe from '../components/SupportMe.vue'

const { t } = useI18n()
const route = useRoute()

const inlineSlot = import.meta.env.VITE_ADSENSE_SLOT_INLINE || ''

const article = useArticle(route.params.slug)
const html = computed(() => article.value ? renderMarkdown(article.value.content) : '')

// SEO：单篇文章按标题/摘要动态更新 <title>、canonical、description
watch(() => article.value, (a) => {
  if (a) setSeo({ title: a.title, description: a.summary, path: `/articles/${a.slug}` })
}, { immediate: true })
onUnmounted(() => { document.title = 'NutriCalc · 营养素计算器' })
</script>

<template>
  <div v-if="!article" class="muted" style="padding: 40px; text-align: center;">
    <p>{{ t('articles.not_found') }}</p>
    <router-link to="/articles" class="article-back">← {{ t('articles.back_to_list') }}</router-link>
  </div>

  <article v-else class="article-detail-page">
    <router-link to="/articles" class="article-back">← {{ t('articles.back_to_list') }}</router-link>

    <header class="article-detail-head">
      <h1>{{ article.title }}</h1>
      <div class="article-meta">
        <span class="article-date">{{ article.date }}</span>
        <span v-for="tag in article.tags" :key="tag" class="article-tag">{{ tag }}</span>
      </div>
      <p class="article-byline muted">
        {{ t('articles.byline_author') }} ·
        <router-link to="/about">{{ t('articles.byline_about') }}</router-link>
      </p>
      <p v-if="article.fallbackUsed" class="article-fallback muted">
        ⚠️ {{ t('articles.translation_unavailable') }}
      </p>
    </header>

    <div class="article-content md-body" v-html="html"></div>

    <AdSlot :key="'inline-' + route.params.slug" kind="inline" :slot-id="inlineSlot" />

    <SupportMe variant="card" />

    <hr class="legal-sep" />
    <p class="legal-seealso muted">
      <router-link to="/articles">← {{ t('articles.back_to_list') }}</router-link>
    </p>
  </article>
</template>
