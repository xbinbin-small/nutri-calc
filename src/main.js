import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'

import App from './App.vue'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import './style.css'

// 首页保持同步加载（最常访问，避免额外一次往返）；
// 其余视图按路由懒加载——首屏 JS 不再背上评估页（720 行）与全部文章正文。
import Calculator from './views/Calculator.vue'
const Assessment  = () => import('./views/Assessment.vue')
const DailyNeeds  = () => import('./views/DailyNeeds.vue')
const FsmpLibrary = () => import('./views/FsmpLibrary.vue')
const About       = () => import('./views/About.vue')
const Privacy     = () => import('./views/Privacy.vue')
const Terms       = () => import('./views/Terms.vue')
const Disclaimer  = () => import('./views/Disclaimer.vue')
const Contact     = () => import('./views/Contact.vue')
const Articles    = () => import('./views/Articles.vue')
const Article     = () => import('./views/Article.vue')
const NotFound    = () => import('./views/NotFound.vue')

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
    // 真 404 视图（不再静默跳首页——那会产生 soft-404，伤 SEO）
    { path: '/:catchAll(.*)', name: 'notfound', component: NotFound }
  ],
  scrollBehavior() { return { top: 0 } }
})

createApp(App).use(i18n).use(router).mount('#app')
