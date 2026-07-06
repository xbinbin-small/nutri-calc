<script setup>
import { useI18n } from 'vue-i18n'
import { useArticleIndex } from '../composables/useArticles.js'

const { t } = useI18n()
const articles = useArticleIndex()
</script>

<template>
  <section class="page-head">
    <h1>{{ t('articles.list_title') }}</h1>
    <p class="sub">{{ t('articles.list_subtitle') }}</p>
  </section>

  <div v-if="articles.length === 0" class="muted" style="padding: 40px; text-align: center;">
    {{ t('articles.no_articles') }}
  </div>

  <div v-else class="article-grid">
    <router-link
      v-for="a in articles"
      :key="a.slug"
      :to="`/articles/${a.slug}`"
      class="article-card"
    >
      <div class="article-meta">
        <span class="article-date">{{ a.date }}</span>
        <span v-for="tag in a.tags" :key="tag" class="article-tag">{{ tag }}</span>
      </div>
      <h2>{{ a.title }}</h2>
      <p class="article-summary">{{ a.summary }}</p>
      <span class="article-read-more">{{ t('articles.read_more') }} →</span>
    </router-link>
  </div>
</template>
