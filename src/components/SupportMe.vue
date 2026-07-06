<script setup>
/**
 * 打赏 / 支持组件 / "Buy me a coffee" support widget.
 *
 * 双渠道，按构建期环境变量启用，未配置的渠道自动隐藏：
 *   VITE_BMC_USERNAME   — Buy Me a Coffee 用户名（海外信用卡）
 *   VITE_AFDIAN_URL     — 爱发电主页完整 URL（国内）
 *   VITE_DONATE_QR      — 设为 "1" 时显示微信/支付宝收款码弹窗
 *                         （需把二维码图片放到 public/donate-wechat.png、public/donate-alipay.png）
 *
 * variant:
 *   "link"  — 页脚里的一行紧凑链接
 *   "card"  — 文章底部的卡片（默认）
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps({
  variant: { type: String, default: 'card' } // card | link
})

const { t } = useI18n()

const bmcUser = (import.meta.env.VITE_BMC_USERNAME || '').trim()
const afdianUrl = (import.meta.env.VITE_AFDIAN_URL || '').trim()
const qrEnabled = (import.meta.env.VITE_DONATE_QR || '').trim() === '1'

const bmcUrl = computed(() => bmcUser ? `https://www.buymeacoffee.com/${bmcUser}` : '')
const hasAny = computed(() => !!bmcUser || !!afdianUrl || qrEnabled)

const qrOpen = ref(false)
</script>

<template>
  <div v-if="hasAny" class="support" :class="variant">
    <div v-if="variant === 'card'" class="support-head">
      <span class="support-emoji" aria-hidden="true">☕️</span>
      <div>
        <div class="support-title">{{ t('support.title') }}</div>
        <div class="support-sub">{{ t('support.subtitle') }}</div>
      </div>
    </div>
    <span v-else class="support-lead">{{ t('support.footer_lead') }}</span>

    <div class="support-actions">
      <a
        v-if="bmcUrl"
        :href="bmcUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="support-btn bmc"
      >☕️ {{ t('support.bmc') }}</a>

      <a
        v-if="afdianUrl"
        :href="afdianUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="support-btn afdian"
      >⚡️ {{ t('support.afdian') }}</a>

      <button
        v-if="qrEnabled"
        type="button"
        class="support-btn qr"
        @click="qrOpen = true"
      >📱 {{ t('support.qr') }}</button>
    </div>
  </div>

  <!-- 收款码弹窗 -->
  <Teleport to="body">
    <div v-if="qrOpen" class="support-modal" @click.self="qrOpen = false">
      <div class="support-modal-inner" role="dialog" aria-modal="true">
        <button class="support-modal-close" @click="qrOpen = false" aria-label="close">✕</button>
        <div class="support-modal-title">{{ t('support.qr_title') }}</div>
        <div class="support-qr-grid">
          <figure>
            <img :src="'/donate-wechat.png'" alt="WeChat Pay" loading="lazy" />
            <figcaption>{{ t('support.wechat') }}</figcaption>
          </figure>
          <figure>
            <img :src="'/donate-alipay.png'" alt="Alipay" loading="lazy" />
            <figcaption>{{ t('support.alipay') }}</figcaption>
          </figure>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.support.card {
  margin: 28px 0 8px;
  padding: 18px 20px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius);
  background: var(--c-bg-warm);
}
.support-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.support-emoji { font-size: 26px; }
.support-title { font-weight: 600; color: var(--c-fg); }
.support-sub { font-size: 13px; color: var(--c-fg-mid); margin-top: 2px; }

.support.link { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
.support-lead { font-size: 12.5px; color: var(--c-fg-soft); }

.support-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.support-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 13.5px; font-weight: 600;
  text-decoration: none; cursor: pointer;
  border: 1px solid transparent;
}
.support-btn.bmc    { background: #ffdd00; color: #1a1a1a; }
.support-btn.afdian { background: #946ce6; color: #fff; }
.support-btn.qr     { background: var(--c-surface); color: var(--c-fg-mid); border-color: var(--c-border-strong); }
.support-btn:hover  { filter: brightness(0.96); }
.support.link .support-btn { padding: 5px 10px; font-size: 12.5px; }

.support-modal {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.support-modal-inner {
  position: relative;
  background: var(--c-surface);
  border-radius: var(--radius);
  padding: 24px 24px 20px;
  max-width: 460px; width: 100%;
  box-shadow: var(--shadow-md);
}
.support-modal-close {
  position: absolute; top: 10px; right: 12px;
  background: none; border: none; font-size: 18px; cursor: pointer;
  color: var(--c-fg-soft);
}
.support-modal-title { font-weight: 600; text-align: center; margin-bottom: 16px; color: var(--c-fg); }
.support-qr-grid { display: flex; gap: 18px; justify-content: center; flex-wrap: wrap; }
.support-qr-grid figure { margin: 0; text-align: center; }
.support-qr-grid img { width: 160px; height: 160px; object-fit: contain; border: 1px solid var(--c-border); border-radius: var(--radius-sm); }
.support-qr-grid figcaption { font-size: 12.5px; color: var(--c-fg-mid); margin-top: 6px; }
</style>
