<script setup>
import { useI18n } from 'vue-i18n'
import { useFeaturedArticles } from '../composables/useArticles.js'

const { t } = useI18n()
const featured = useFeaturedArticles(3)
</script>

<template>
  <section v-if="featured.length > 0" class="featured-articles">
    <div class="featured-head">
      <h2>{{ t('featured_articles.title') }}</h2>
      <router-link to="/articles" class="featured-see-all">{{ t('featured_articles.see_all') }} →</router-link>
    </div>
    <div class="featured-grid">
      <router-link
        v-for="a in featured"
        :key="a.slug"
        :to="`/articles/${a.slug}`"
        class="featured-card"
      >
        <div class="featured-date muted">{{ a.date }}</div>
        <h3>{{ a.title }}</h3>
        <p>{{ a.summary }}</p>
      </router-link>
    </div>
  </section>
</template>
