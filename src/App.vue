<script setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import LanguageSwitch from './components/LanguageSwitch.vue'
import AdSlot from './components/AdSlot.vue'
import SupportMe from './components/SupportMe.vue'
import CookieConsent from './components/CookieConsent.vue'
import { setSeo } from './composables/useSeo.js'
import { adsenseEnabled, ensureAdsenseScript } from './composables/useAdsense.js'

const { t, locale } = useI18n()
const route = useRoute()
const year = new Date().getFullYear()

// 每页 SEO 头信息（标题 / canonical / 描述）。文章页由 Article.vue 自行设置（含文章标题）。
watch([() => route.name, locale], () => {
  const name = route.name
  if (!name || name === 'article') return
  setSeo({
    title: t(`seo.${name}.title`),
    description: t(`seo.${name}.desc`),
    path: route.path
  })
}, { immediate: true })

// AdSense 广告单元 ID（构建期注入）
const railSlot = import.meta.env.VITE_ADSENSE_SLOT_RAIL || ''

// 仅在“内容页”展示广告：首页 / 文章 / 关于。
// 切勿在 /assessment（患者可识别数据）等临床页加载广告脚本——见 clinical-content.md。
const AD_PAGES = ['calculator', 'articles', 'article', 'about']
const showAds = computed(() => AD_PAGES.includes(route.name))

// 进入内容页时加载 AdSense 脚本（即便此时尚无广告单元，也供 AdSense 站点审核/自动广告使用）。
// 仅在内容页加载，评估等患者数据页不加载——与隐私承诺一致。
watch(showAds, (v) => { if (v && adsenseEnabled) ensureAdsenseScript() }, { immediate: true })

const navItems = computed(() => [
  { to: '/articles',   key: 'articles' },
  { to: '/',           key: 'calculator' },
  { to: '/assessment', key: 'assessment' },
  { to: '/daily',      key: 'daily_needs' },
  { to: '/fsmp',       key: 'fsmp' },
  { to: '/about',      key: 'about' }
])

function isActive(path) {
  if (path === '/') return route.path === '/' || route.path === ''
  return route.path.startsWith(path)
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <router-link to="/" class="brand">
        <span class="logo">N</span>
        <div>
          <div class="name">{{ t('app.title') }}</div>
          <div class="tagline">{{ t('app.tagline') }}</div>
        </div>
      </router-link>
      <nav class="nav-links">
        <router-link
          v-for="n in navItems"
          :key="n.to"
          :to="n.to"
          class="nav-link"
          :class="{ active: isActive(n.to) }"
        >{{ t('nav.' + n.key) }}</router-link>
        <LanguageSwitch />
      </nav>
    </div>
  </header>

  <main class="page-layout">
    <aside v-if="showAds" class="ad-rail left">
      <AdSlot :key="'rail-l-' + route.path" kind="rail" :slot-id="railSlot" />
    </aside>

    <div class="content">
      <router-view />
    </div>

    <aside v-if="showAds" class="ad-rail right">
      <AdSlot :key="'rail-r-' + route.path" kind="rail" :slot-id="railSlot" />
    </aside>
  </main>

  <footer class="footer">
    <nav class="footer-nav">
      <router-link to="/privacy">{{ t('footer_links.privacy') }}</router-link>
      <span class="footer-sep">·</span>
      <router-link to="/terms">{{ t('footer_links.terms') }}</router-link>
      <span class="footer-sep">·</span>
      <router-link to="/disclaimer">{{ t('footer_links.disclaimer') }}</router-link>
      <span class="footer-sep">·</span>
      <router-link to="/contact">{{ t('footer_links.contact') }}</router-link>
    </nav>
    <SupportMe variant="link" />
    <div class="footer-copy">{{ t('app.footer', { year }) }}</div>
  </footer>

  <CookieConsent />
</template>
