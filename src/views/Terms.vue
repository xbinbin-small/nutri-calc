<script setup>
import { useI18n } from 'vue-i18n'
import { useLegalPage } from '../composables/useLegalPage.js'

const { t } = useI18n()
const data = useLegalPage('terms')
</script>

<template>
  <article class="legal-page">
    <h1>{{ data.title }}</h1>
    <p class="legal-meta muted">{{ data.last_updated }}</p>
    <p class="legal-intro">{{ data.intro }}</p>

    <section v-for="(s, i) in data.sections" :key="i">
      <h2>{{ s.h }}</h2>
      <p v-if="s.p">{{ s.p }}</p>
      <ul v-if="s.ul">
        <li v-for="(item, j) in s.ul" :key="j">{{ item }}</li>
      </ul>
      <p v-if="s.after">{{ s.after }}</p>
    </section>

    <hr class="legal-sep" />
    <p class="legal-seealso muted">
      <span>{{ t('common.see_also') }}：</span>
      <router-link to="/privacy">{{ t('footer_links.privacy') }}</router-link>
      <span> · </span>
      <router-link to="/disclaimer">{{ t('footer_links.disclaimer') }}</router-link>
      <span> · </span>
      <router-link to="/contact">{{ t('footer_links.contact') }}</router-link>
    </p>
  </article>
</template>
