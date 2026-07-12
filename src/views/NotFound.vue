<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="notfound card">
    <h1>{{ t('notfound.title') }}</h1>
    <p class="muted">{{ t('notfound.desc') }}</p>
    <p>
      <router-link to="/">{{ t('notfound.home') }}</router-link>
      <span class="footer-sep"> · </span>
      <router-link to="/articles">{{ t('notfound.articles') }}</router-link>
    </p>
  </section>
</template>

<style scoped>
.notfound {
  max-width: 560px;
  margin: 48px auto;
  text-align: center;
  padding: 40px 24px;
}
</style>
