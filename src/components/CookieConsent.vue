<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { adsenseEnabled } from '../composables/useAdsense.js'

const { t } = useI18n()

const STORAGE_KEY = 'nutri.cookie.consent.v1'
const visible = ref(false)
// 启用 AdSense 时改用包含广告 Cookie 说明的文案
const messageKey = adsenseEnabled ? 'cookie.message_ads' : 'cookie.message'

onMounted(() => {
  try {
    if (!localStorage.getItem(STORAGE_KEY)) visible.value = true
  } catch {
    // localStorage 不可用时默认显示一次，关闭后即视为同意
    visible.value = true
  }
})

function accept() {
  try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  visible.value = false
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="cookie-banner" role="dialog" aria-live="polite">
      <div class="cookie-text">
        {{ t(messageKey) }}
        <router-link to="/privacy" class="cookie-link">{{ t('cookie.learn_more') }}</router-link>
      </div>
      <button class="btn btn-sm" @click="accept">{{ t('cookie.accept') }}</button>
    </div>
  </Transition>
</template>

<style scoped>
.cookie-banner {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  max-width: 720px;
  width: calc(100% - 40px);
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 1000;
  font-size: 13.5px;
  line-height: 1.55;
}
.cookie-text { flex: 1; color: var(--c-fg-mid); }
.cookie-link {
  color: var(--c-primary);
  text-decoration: none;
  border-bottom: 1px dotted var(--c-primary);
  margin-left: 4px;
  white-space: nowrap;
}
.cookie-link:hover { color: var(--c-primary-strong); }

.slide-up-enter-active, .slide-up-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
.slide-up-enter-to, .slide-up-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}

@media (max-width: 600px) {
  .cookie-banner {
    flex-direction: column;
    align-items: stretch;
    bottom: 12px;
    padding: 14px;
  }
}
</style>
