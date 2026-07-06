/**
 * 法律页面（Privacy / Terms / Disclaimer / Contact）的多语种数据读取。
 *
 * 为什么不用 vue-i18n 的 t()/tm()：
 *   这些页面用嵌套的 sections 数组（{ h, p, ul, after }），
 *   tm() 在 v10 对深层对象数组的解析不稳定（会渲染为空）。
 *   直接 import JSON + computed 切换 locale，简单可靠。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

export function useLegalPage(pageKey) {
  const { locale } = useI18n()
  return computed(() => {
    const messages = locale.value === 'en-US' ? enUS : zhCN
    return messages[pageKey] || {}
  })
}
