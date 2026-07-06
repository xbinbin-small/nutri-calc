---
description: Vue + i18n + state conventions for the UI layer.
paths:
  - "src/views/**"
  - "src/components/**"
---

# UI 层规范

## i18n 是硬要求

- 所有展示给用户的字符串必须通过 `t('key.path')` 或模板里的 `{{ t('...') }}`
- 添加新 key 必须**同时**更新 `src/locales/zh-CN.json` 和 `src/locales/en-US.json`；遗漏会在英文模式下显示 key 字面值（用户可见的 UI 退化）
- 优先用中文撰写文案（项目默认 `zh-CN`，`localStorage['nutri.locale']` 持久化），再翻译英文
- key 路径按页面/区段组织（如 `assessment.r.glim_title`、`calculator.tab_food`），不要乱平铺

## i18n 复杂结构

`vue-i18n v10` 的 `tm()` + `rt()` 对**嵌套对象数组**（如 `[{h, p, ul, after}, ...]`）的解析不稳定，会渲染为空。已踩过这个坑（法律页面 Privacy / Contact 一度全空）。

对于这种结构，**改用直接 import JSON + computed 切换 locale**，参考 `src/composables/useLegalPage.js` 的写法。简单的 `t()` 用法和数组 of strings（用 `tm()` + `rt()`）不受影响。

`src/components/ToolContent.vue` 用同样的直接 import 方式渲染工具页说明区（计算器/评估/每日需求/FSMP 库下方的"介绍·方法依据·怎么用·常见问题·免责"），内容来自 locale 的 `<ns>.about`（含 `faq: [{q, a}]` 嵌套数组）。它存在的目的是给爬虫/AdSense 可抓取的实质正文（破"低价值内容"），**不要删**——详见根 `CLAUDE.md` 的 Monetization。

## 状态管理（不用 Pinia）

按用途选：

1. **跨组件共享** → 写一个 `useXxx.js` composable，导出 module-level `reactive()` / `computed()`（参考 `src/composables/useCalcStore.js`）
2. **组件本地** → 在 `<script setup>` 里直接 `ref` / `reactive`

需要持久化的状态使用 `localStorage`，**key 必须带版本号**（如 `nutri.calc.items.v1`），便于以后改 schema 时旧数据兼容/废弃。当前在用的 keys：

| Key | 用途 |
|---|---|
| `nutri.locale` | 语言选择 |
| `nutri.calc.items.v1` | 计算器已选食物/特医食品 |
| `nutri.assessment.v1` | 评估表单输入 |
| `nutri.admin.v1` | 管理员令牌 |
| `nutri.admin.provider` | 管理员选定的 provider |
| `nutri.cookie.consent.v1` | Cookie 横幅是否被确认 |

## Vue Router（history mode）

- 使用 `createWebHistory(import.meta.env.BASE_URL)`；URL 形如 `/assessment`（无 `#`），利于 SEO 与 AdSense 收录
- **依赖 SPA 回退**：深层路径刷新需服务器回退到 `index.html`。已在 `public/_redirects`（`/* /index.html 200`）、`netlify.toml`、`vercel.json` 配好；Cloudflare Pages Functions（`/api/*`）优先级高于回退，不受影响
- ⚠️ **`vite.config.js` 必须 `base: '/'`**（绝对路径）。若改回相对 `./`，深层路径下 `./assets/...` 会解析到错误目录导致白屏
- 路由外的开关一律用 query string（`new URLSearchParams(window.location.search)`）；老的 `#admin` 哈希触发已废弃，改用 `?admin=1`
- `src/main.js` 顶部有老链接兼容跳转：把历史遗留的 `/#/x` 一次性重写为 `/x`（迁移自 hash 模式），勿删
- 每页 SEO 头（title/canonical/description）由 `src/composables/useSeo.js` 设置：静态路由在 `App.vue` 的 `watch` 里、文章页在 `Article.vue` 里调用 `setSeo()`

## Markdown 渲染（AI 输出）

`useAiAssessment.js` 的 `renderMarkdown` 是**手写极简实现**，为了不增加 bundle 体积。它对 `<`、`>`、`&` 做了首次转义，但仍有边界（LLM 输出的特殊构造、Prompt Injection）。

**支持的语法**：GFM 表格、`#`~`######` 标题、有序/无序列表、`**粗体**`/`*斜体*`、`> 引用`、`代码`/```代码块```。**不支持行内链接** `[文字](url)`。`renderMarkdown` 同时被文章（`Article.vue`）复用——所以**文章里的参考资料链接要写成纯文本 URL**，不要用 `[]()` 语法（否则原样显示）。

**如果未来 AI 输出格式问题持续出现，或安全顾虑升级**：引入 `marked` + `DOMPurify`。DOMPurify 是必要的，因为 LLM 输出在临床场景里若被恶意诱导（比如患者诊断字段藏 prompt injection 文本），可能产生 XSS。当前认为风险较低没有引入，但这是已识别的技术债。

## 管理员面板

- 触发器：URL 加 `?admin=1`（在 `Assessment.vue` `onMounted` 里读 `window.location.search`）
- UI 在 `Assessment.vue` 模板底部，黄色虚线框
- 真正的鉴权在后端（`x-admin-token` header 对比 `env.ADMIN_TOKEN`）
- 前端只是开关 UI——所以触发条件没必要做得多隐蔽，**不要为了"看起来更隐藏"而把 UI 触发器搞复杂**

如果新增管理员功能：
1. UI 加在 `.admin-panel` 区块内
2. 通过 `setAdminToken` / `setAdminProvider` 之外的 localStorage key 存储设置
3. 通过 header 透传到 Function（`useAiAssessment.js::run()` 那个 fetch 的 headers）；后端在 `isAdmin` 通过后才使用这些 header

## CSS

风格用浅黄米色调（`#fbf7ee` 系），主色 `--c-primary` 偏深绿。全局变量在 `src/style.css` 里。组件局部样式用 `<style scoped>`。

不要引入 UI 框架（Tailwind / Element Plus / Vuetify 等）——当前是纯 CSS + CSS 变量，JS bundle 在 ~100 KB gzip 量级（包含真实 FSMP 数据 + 文章 + 法律页），加框架会显著膨胀。
