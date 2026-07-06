/**
 * 前端 AI 深度解读客户端
 *  - 把 patient + calculated 发到 /api/ai-assessment
 *  - 普通用户：不携带 admin token，provider 由后端 env DEFAULT_PROVIDER 决定
 *  - 管理员：localStorage 里写入 admin token 后，可以传递 x-provider header 切换模型
 */

import { ref } from 'vue'

const ADMIN_KEY = 'nutri.admin.v1'
const PROVIDER_KEY = 'nutri.admin.provider'

export function getAdminToken() {
  try { return localStorage.getItem(ADMIN_KEY) || '' } catch { return '' }
}
export function setAdminToken(v) {
  try {
    if (v) localStorage.setItem(ADMIN_KEY, v)
    else   localStorage.removeItem(ADMIN_KEY)
  } catch {}
}
export function getAdminProvider() {
  try { return localStorage.getItem(PROVIDER_KEY) || '' } catch { return '' }
}
export function setAdminProvider(v) {
  try {
    if (v) localStorage.setItem(PROVIDER_KEY, v)
    else   localStorage.removeItem(PROVIDER_KEY)
  } catch {}
}

export function useAiAssessment() {
  const loading = ref(false)
  const error   = ref(null)
  const narrative = ref('')
  const provider  = ref('')
  const model     = ref('')
  const usage     = ref(null)

  async function run({ patient, calculated, locale, turnstileToken }) {
    loading.value = true
    error.value = null
    narrative.value = ''
    provider.value = ''
    model.value = ''
    usage.value = null

    const headers = { 'Content-Type': 'application/json' }
    const adminTok = getAdminToken()
    const adminProv = getAdminProvider()
    if (adminTok) headers['x-admin-token'] = adminTok
    if (adminTok && adminProv) headers['x-provider'] = adminProv

    try {
      const res = await fetch('/api/ai-assessment', {
        method: 'POST',
        headers,
        body: JSON.stringify({ patient, calculated, locale, turnstileToken })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`)
      }
      narrative.value = data.narrative || ''
      provider.value  = data.provider  || ''
      model.value     = data.model     || ''
      usage.value     = data.usage     || null
    } catch (e) {
      error.value = e.message || String(e)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, narrative, provider, model, usage, run }
}

/**
 * 极简 markdown → html（够用即可，不引入额外依赖以节省 bundle）
 * 仅支持：标题 / 列表 / 加粗 / 引用 / 代码段 / 表格基础
 */
export function renderMarkdown(md) {
  if (!md) return ''
  let s = md.trim()

  // 转义 < >
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // 代码块 ```
  s = s.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-pre"><code>${code}</code></pre>`
  })

  // 表格 (简单 GFM)
  s = s.replace(/(^\|.+\|\n\|[\s|:-]+\|\n(?:\|.+\|\n?)+)/gm, (block) => {
    const rows = block.trim().split('\n')
    const header = rows[0].split('|').slice(1, -1).map((c) => c.trim())
    const bodyRows = rows.slice(2).map((r) => r.split('|').slice(1, -1).map((c) => c.trim()))
    const thead = `<thead><tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`
    const tbody = `<tbody>${bodyRows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
    return `<table class="md-table">${thead}${tbody}</table>`
  })

  // 标题
  s = s.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
       .replace(/^##### (.+)$/gm,  '<h5>$1</h5>')
       .replace(/^#### (.+)$/gm,   '<h4>$1</h4>')
       .replace(/^### (.+)$/gm,    '<h3>$1</h3>')
       .replace(/^## (.+)$/gm,     '<h2>$1</h2>')
       .replace(/^# (.+)$/gm,      '<h1>$1</h1>')

  // 引用（注意：转义后 `>` 已变成 `&gt;`）
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

  // 加粗 / 斜体
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^\*])\*([^\*]+)\*(?!\*)/g, '$1<em>$2</em>')

  // 无序列表
  s = s.replace(/(^|\n)((?:[-*] .+\n?)+)/g, (_, lead, block) => {
    const items = block.trim().split('\n').map((l) => l.replace(/^[-*] /, ''))
    return `${lead}<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
  })

  // 有序列表
  s = s.replace(/(^|\n)((?:\d+\. .+\n?)+)/g, (_, lead, block) => {
    const items = block.trim().split('\n').map((l) => l.replace(/^\d+\. /, ''))
    return `${lead}<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`
  })

  // 行内代码
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 段落（连续非标签行）
  s = s.split(/\n{2,}/).map((para) => {
    if (/^<(h\d|ul|ol|pre|blockquote|table)/.test(para.trim())) return para
    return `<p>${para.replace(/\n/g, '<br>')}</p>`
  }).join('\n')

  return s
}
