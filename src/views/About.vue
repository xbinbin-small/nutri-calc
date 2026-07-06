<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { setSeo } from '../composables/useSeo.js'

const { t, tm, rt } = useI18n()

onMounted(() => {
  setSeo({ title: t('seo.about.title'), description: t('seo.about.desc'), path: '/about' })
})
</script>

<template>
  <section class="page-head">
    <h1>{{ t('about.title') }}</h1>
    <p class="sub">{{ t('about.intro') }}</p>
  </section>

  <div class="card">
    <h2>{{ t('about.mission_title') }}</h2>
    <p class="muted">{{ t('about.mission') }}</p>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <h2>{{ t('about.principles_title') }}</h2>
      <ul style="padding-left: 20px;">
        <li v-for="(p, i) in tm('about.principles')" :key="i" style="margin-bottom: 6px;">{{ rt(p) }}</li>
      </ul>
    </div>

    <div class="card">
      <h2>{{ t('about.sources_title') }}</h2>
      <p class="muted">{{ t('about.sources_intro') }}</p>
      <ul style="padding-left: 20px;">
        <li v-for="(s, i) in tm('about.sources')" :key="i" style="margin-bottom: 6px;">{{ rt(s) }}</li>
      </ul>
    </div>
  </div>

  <div class="card">
    <h2>{{ t('about.tools_title') }}</h2>
    <p class="muted">{{ t('about.tools_intro') }}</p>
    <ul style="padding-left: 20px;">
      <li v-for="(tool, i) in tm('about.tools')" :key="i" style="margin-bottom: 6px;">{{ rt(tool) }}</li>
    </ul>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <h2>{{ t('about.data_title') }}</h2>
      <p class="muted">{{ t('about.data_intro') }}</p>
      <ul style="padding-left: 20px;">
        <li v-for="(d, i) in tm('about.data')" :key="i" style="margin-bottom: 6px;">{{ rt(d) }}</li>
      </ul>
    </div>

    <div class="card">
      <h2>{{ t('about.review_title') }}</h2>
      <p class="muted">{{ t('about.review') }}</p>
    </div>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <h2>{{ t('about.privacy_title') }}</h2>
      <p class="muted">
        {{ t('about.privacy') }}
        <router-link to="/privacy">{{ t('about.privacy_link') }}</router-link>
      </p>
    </div>

    <div class="card">
      <h2>{{ t('about.contact_title') }}</h2>
      <p class="muted">
        {{ t('about.contact') }}
        <a href="mailto:contact@125261.xyz">contact@125261.xyz</a>
      </p>
    </div>
  </div>

  <div class="card">
    <h2>{{ t('about.disclaimer_title') }}</h2>
    <p class="muted">{{ t('about.disclaimer') }}</p>
  </div>
</template>
