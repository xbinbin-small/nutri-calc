<script setup>
/**
 * 广告位组件 / Ad slot.
 *
 * 已配置发布商 ID（VITE_ADSENSE_CLIENT）时渲染真实 Google AdSense 广告；
 * 未配置时：开发环境显示占位框，生产环境不渲染任何内容（保持页面干净）。
 *
 * 用法 / Usage:
 *   <AdSlot kind="rail"   :slot-id="..." />   180×600 侧栏摩天柱
 *   <AdSlot kind="inline" :slot-id="..." />   页面内嵌（响应式）
 *   <AdSlot kind="banner" :slot-id="..." />   横幅
 *
 * ⚠️ 仅可用于内容页（文章 / 关于 / 首页），切勿用于含患者可识别数据的页面
 *    （/assessment 等）——见 .claude/rules/clinical-content.md。
 */
import { onMounted, ref } from 'vue'
import { adsenseClient, adsenseEnabled, ensureAdsenseScript, pushAd } from '../composables/useAdsense.js'

const props = defineProps({
  kind: { type: String, default: 'banner' },   // banner | rail | inline
  slotId: { type: String, default: '' },        // AdSense 广告单元 ID（data-ad-slot）
  label: { type: String, default: '' }
})

const isDev = import.meta.env.DEV
// 真实广告：已配置发布商 ID 且提供了广告单元 ID
const live = adsenseEnabled && !!props.slotId
// 占位框：仅在开发环境且未启用真实广告时显示
const showPlaceholder = isDev && !live

const insEl = ref(null)

onMounted(() => {
  if (!live) return
  ensureAdsenseScript()
  pushAd()
})
</script>

<template>
  <!-- 真实 AdSense 广告 -->
  <ins
    v-if="live"
    ref="insEl"
    class="adsbygoogle ad-slot"
    :class="kind"
    :data-kind="kind"
    style="display:block"
    :data-ad-client="adsenseClient"
    :data-ad-slot="slotId"
    data-ad-format="auto"
    data-full-width-responsive="true"
  ></ins>

  <!-- 开发环境占位 -->
  <div v-else-if="showPlaceholder" class="ad-slot" :class="kind" :data-kind="kind">
    <slot>
      <span>{{ label || 'AD · ' + kind.toUpperCase() }}</span>
    </slot>
  </div>
</template>
