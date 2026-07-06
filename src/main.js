import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'

import App from './App.vue'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import './style.css'

import Calculator from './views/Calculator.vue'
import Assessment from './views/Assessment.vue'
import DailyNeeds from './views/DailyNeeds.vue'
import FsmpLibrary from './views/FsmpLibrary.vue'
import About from './views/About.vue'
import Privacy from './views/Privacy.vue'
import Terms from './views/Terms.vue'
import Disclaimer from './views/Disclaimer.vue'
import Contact from './views/Contact.vue'
import Articles from './views/Articles.vue'
import Article from './views/Article.vue'

// 老链接兼容：从 hash 模式迁移到 history 模式后，把被收录/分享的旧网址
// （形如 /#/articles/glim-intro）一次性重写成无 # 的真实路径，避免落到首页。
const legacyHash = window.location.hash
if (legacyHash.startsWith('#/')) {
  const clean = legacyHash.slice(1) // '/articles/glim-intro'
  // 保留原 query（如 ?admin=1），且避免与 clean 自带 query 重复
  const search = clean.includes('?') ? '' : window.location.search
  window.history.replaceState(null, '', clean + search)
}

const savedLocale = localStorage.getItem('nutri.locale') || 'zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, 'en-US': enUS }
})

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/',           name: 'calculator', component: Calculator },
    { path: '/assessment', name: 'assessment', component: Assessment },
    { path: '/daily',      name: 'daily',      component: DailyNeeds },
    { path: '/fsmp',      name: 'fsmp',       component: FsmpLibrary },
    { path: '/about',     name: 'about',      component: About },
    { path: '/articles',           name: 'articles', component: Articles },
    { path: '/articles/:slug',     name: 'article',  component: Article },
    { path: '/privacy',    name: 'privacy',    component: Privacy },
    { path: '/terms',      name: 'terms',      component: Terms },
    { path: '/disclaimer', name: 'disclaimer', component: Disclaimer },
    { path: '/contact',    name: 'contact',    component: Contact },
    { path: '/:catchAll(.*)', redirect: '/' }
  ],
  scrollBehavior() { return { top: 0 } }
})

createApp(App).use(i18n).use(router).mount('#app')
