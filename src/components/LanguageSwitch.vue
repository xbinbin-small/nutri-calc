<script setup>
import { useI18n } from 'vue-i18n'

const { locale, t } = useI18n()

function toggle() {
  locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  localStorage.setItem('nutri.locale', locale.value)
  document.documentElement.lang = locale.value
}
</script>

<template>
  <button class="lang-btn" @click="toggle" :title="t('lang.switch')">
    {{ t('lang.current') }} ⇄ {{ t('lang.switch') }}
  </button>
</template>
