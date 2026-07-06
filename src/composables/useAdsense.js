/**
 * Google AdSense 接入辅助 / AdSense integration helper.
 *
 * 设计要点 / Design notes:
 * - 发布商 ID 来自构建期环境变量 VITE_ADSENSE_CLIENT（形如 "ca-pub-1234567890123456"）。
 *   未配置时整站不加载任何广告脚本，AdSlot 仅在开发环境显示占位框。
 * - 脚本只懒加载一次；首次真正需要展示广告时才注入 <script>，
 *   因此在不展示广告的页面（如 /assessment 患者数据页）不会引入第三方追踪脚本。
 * - EU/UK 的同意管理（CMP）由 Google 自家「Privacy & messaging」消息在 AdSense 后台开启后，
 *   随该脚本自动下发，无需前端另行实现。
 */

export const adsenseClient = (import.meta.env.VITE_ADSENSE_CLIENT || '').trim()

// 是否已配置发布商 ID（决定是否加载真实广告）
export const adsenseEnabled = adsenseClient.startsWith('ca-pub-')

let scriptLoading = false

/**
 * 确保 AdSense 脚本已注入页面（幂等）。仅在已配置发布商 ID 时生效。
 */
export function ensureAdsenseScript() {
  if (!adsenseEnabled || scriptLoading) return
  if (typeof document === 'undefined') return
  scriptLoading = true

  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}

/**
 * 请求填充一个已渲染的 <ins class="adsbygoogle"> 广告位。
 */
export function pushAd() {
  if (!adsenseEnabled || typeof window === 'undefined') return
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } catch {
    // adsbygoogle 尚未就绪时静默忽略；脚本加载后会自动重试已入队的广告位
  }
}
