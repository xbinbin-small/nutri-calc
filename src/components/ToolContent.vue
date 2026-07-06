<script setup>
/**
 * 工具页说明区 / Crawlable explainer block for tool pages.
 *
 * 在计算器 / 评估 / 每日需求 / FSMP 库等工具下方渲染一段真实可抓取的正文
 * （介绍、方法依据、使用步骤、常见问题、免责），帮助搜索引擎与 AdSense 把
 * 这些交互工具识别为有实质内容的页面，而不是"薄页"。
 *
 * 内容来自 locale 的 `<ns>.about`。沿用 useLegalPage 的直接 import 方式，
 * 规避 vue-i18n tm/rt 对嵌套对象数组解析不稳定的问题。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

const props = defineProps({ ns: { type: String, required: true } })
const { locale } = useI18n()

const data = computed(() => {
  const msgs = locale.value === 'en-US' ? enUS : zhCN
  return msgs[props.ns]?.about || null
})
</script>

<template>
  <section v-if="data" class="tool-about card">
    <h2>{{ data.title }}</h2>
    <p v-for="(p, i) in data.intro" :key="'i' + i" class="muted">{{ p }}</p>

    <h3>{{ data.basis_title }}</h3>
    <ul class="tool-about-list">
      <li v-for="(b, i) in data.basis" :key="'b' + i">{{ b }}</li>
    </ul>

    <h3>{{ data.use_title }}</h3>
    <ol class="tool-about-list">
      <li v-for="(u, i) in data.use" :key="'u' + i">{{ u }}</li>
    </ol>

    <h3>{{ data.faq_title }}</h3>
    <div v-for="(f, i) in data.faq" :key="'f' + i" class="tool-faq">
      <p class="tool-faq-q">{{ f.q }}</p>
      <p class="muted">{{ f.a }}</p>
    </div>

    <p v-if="data.note" class="tool-about-note muted">{{ data.note }}</p>
  </section>
</template>

<style scoped>
.tool-about { margin-top: 22px; }
.tool-about h3 { margin-top: 18px; }
.tool-about-list { padding-left: 20px; margin: 8px 0; }
.tool-about-list li { margin-bottom: 6px; line-height: 1.6; }
.tool-faq { margin-bottom: 12px; }
.tool-faq-q { font-weight: 600; margin-bottom: 2px; }
.tool-about-note { margin-top: 16px; font-size: 13px; }
</style>
