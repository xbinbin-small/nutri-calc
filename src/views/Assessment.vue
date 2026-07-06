<script setup>
import { reactive, computed, ref, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { runAssessment } from '../composables/useAssessment.js'
import {
  useAiAssessment, renderMarkdown,
  getAdminToken, setAdminToken,
  getAdminProvider, setAdminProvider
} from '../composables/useAiAssessment.js'
import ToolContent from '../components/ToolContent.vue'

const { t, locale } = useI18n()
const isZh = computed(() => locale.value === 'zh-CN')

const STORE_KEY = 'nutri.assessment.v1'

function blankPatient() {
  return {
    patient_info: {
      name: '', gender: 'male', age: null,
      height_cm: null, weight_kg: null,
      usual_weight_kg: null, weight_loss_duration_months: null
    },
    diagnoses: [''],
    chief_complaint: '',
    present_illness: '',
    past_history: '',
    physical_exam: { temperature: null, blood_pressure: '', pulse: null, respiration: null, general: '', abdomen: '' },
    dietary_info: { intake_percentage: null, dietary_restrictions: '', swallowing_difficulty: '' },
    lab_results: {
      biochemistry: [
        { name: '白蛋白',       value: '', unit: 'g/L' },
        { name: '前白蛋白',     value: '', unit: 'mg/L' },
        { name: 'C反应蛋白',    value: '', unit: 'mg/L' },
        { name: '血糖',         value: '', unit: 'mmol/L' },
        { name: '总蛋白',       value: '', unit: 'g/L' }
      ],
      complete_blood_count: [
        { name: '血红蛋白',     value: '', unit: 'g/L' },
        { name: '淋巴细胞计数', value: '', unit: '×10^9/L' }
      ]
    },
    NRS2002_score: null
  }
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return blankPatient()
}

const patient = reactive(loadInitial())
const showReport = ref(false)

watch(patient, (v) => localStorage.setItem(STORE_KEY, JSON.stringify(v)), { deep: true })

const labNames = {
  '白蛋白':       'Albumin',
  '前白蛋白':     'Prealbumin',
  'C反应蛋白':    'C-Reactive Protein',
  '血糖':         'Glucose',
  '总蛋白':       'Total Protein',
  '血红蛋白':     'Hemoglobin',
  '淋巴细胞计数': 'Lymphocyte Count'
}
function labLabel(name) { return isZh.value ? name : (labNames[name] || name) }

function addDiagnosis()  { patient.diagnoses.push('') }
function removeDiagnosis(i) { patient.diagnoses.splice(i, 1) }

function loadSample() {
  Object.assign(patient, {
    patient_info: { name: '张三', gender: 'male', age: 65, height_cm: 170, weight_kg: 52, usual_weight_kg: 65, weight_loss_duration_months: 3 },
    diagnoses: ['胃癌术后', '2型糖尿病'],
    chief_complaint: '进食差伴体重下降',
    present_illness: '术后食欲下降，进食约为平时一半。',
    past_history: '2型糖尿病病史10年。',
    physical_exam: { temperature: 36.7, blood_pressure: '128/80', pulse: 86, respiration: 18, general: '消瘦貌', abdomen: '' },
    dietary_info: { intake_percentage: 50, dietary_restrictions: '糖尿病饮食', swallowing_difficulty: 'no' },
    lab_results: {
      biochemistry: [
        { name: '白蛋白',     value: 28,  unit: 'g/L' },
        { name: '前白蛋白',   value: 150, unit: 'mg/L' },
        { name: 'C反应蛋白',  value: 25,  unit: 'mg/L' },
        { name: '血糖',       value: 7.8, unit: 'mmol/L' },
        { name: '总蛋白',     value: 56,  unit: 'g/L' }
      ],
      complete_blood_count: [
        { name: '血红蛋白',     value: 95,  unit: 'g/L' },
        { name: '淋巴细胞计数', value: 0.9, unit: '×10^9/L' }
      ]
    },
    NRS2002_score: 5
  })
}

function resetForm() {
  Object.assign(patient, blankPatient())
  showReport.value = false
}

const result = computed(() => runAssessment(patient))

function runReport() {
  showReport.value = true
  window.setTimeout(() => {
    document.getElementById('report-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}

function copyJson() {
  navigator.clipboard?.writeText(JSON.stringify(patient, null, 2))
}

function copyReport() {
  const r = result.value
  const txt = renderTextReport(r, isZh.value)
  navigator.clipboard?.writeText(txt)
}

function renderTextReport(r, zh) {
  const L = (a, b) => zh ? a : b
  const lines = []
  lines.push(`# ${L('营养评估报告', 'Nutrition Assessment Report')}`)
  lines.push('')
  lines.push(`## ${L('一、基本情况', '1. Overview')}`)
  if (r.bmi != null) lines.push(`- BMI: ${r.bmi}`)
  if (r.weightLoss != null && r.weightLoss > 0) lines.push(`- ${L('体重下降', 'Weight loss')}: ${r.weightLoss}%`)
  if (r.nrs2002) lines.push(`- NRS2002: ${r.nrs2002.score} (${r.nrs2002.risk ? L('有风险', 'at risk') : L('无明显风险', 'no clear risk')})`)
  lines.push(`- ${L('应激水平', 'Stress level')}: ${r.stressLevel}`)
  lines.push('')
  lines.push(`## ${L('二、GLIM 营养不良诊断', '2. GLIM Malnutrition Diagnosis')}`)
  if (r.glim.hasMalnutrition) {
    lines.push(`- ${L('诊断', 'Diagnosis')}: ${r.glim.severity === 'severe' ? L('重度营养不良', 'Severe malnutrition') : L('中度营养不良', 'Moderate malnutrition')}`)
  } else {
    lines.push(`- ${L('暂不符合 GLIM 营养不良诊断', 'Does not currently meet GLIM malnutrition criteria')}`)
  }
  lines.push('')
  lines.push(`## ${L('三、营养目标', '3. Targets')}`)
  if (r.energyTarget) lines.push(`- ${L('能量', 'Energy')}: ${r.energyTarget.low}–${r.energyTarget.high} kcal/d`)
  if (r.proteinTarget) lines.push(`- ${L('蛋白质', 'Protein')}: ${r.proteinTarget.low}–${r.proteinTarget.high} g/d`)
  lines.push('')
  lines.push(`## ${L('四、PES 营养诊断', '4. PES')}`)
  for (const p of r.pes) {
    lines.push(`- ${zh ? p.problem_zh : p.problem_en} | ${zh ? p.etiology_zh : p.etiology_en} | ${zh ? p.signs_zh : p.signs_en}`)
  }
  lines.push('')
  lines.push(`## ${L('五、化验解读', '5. Lab Interpretation')}`)
  for (const l of r.labFlags) {
    lines.push(`- ${zh ? l.name_zh : l.name_en}: ${l.value} ${l.unit} — ${zh ? l.comment_zh : l.comment_en}`)
  }
  lines.push('')
  lines.push(`## ${L('六、干预建议', '6. Action Plan')}`)
  for (const a of r.actions) lines.push(`- ${zh ? a.zh : a.en}`)
  return lines.join('\n')
}

const stressLabel = computed(() => {
  const map = {
    mild: { zh: '轻度', en: 'Mild' },
    moderate: { zh: '中度', en: 'Moderate' },
    severe: { zh: '重度', en: 'Severe' }
  }
  return map[result.value.stressLevel] || map.mild
})

function bmiTone(cat) {
  if (!cat) return 'gray'
  if (cat.severity === 'normal') return 'pill'
  if (cat.severity === 'severe') return 'red'
  return 'amber'
}

/* ─── AI 深度解读 ────────────────────────────────────────────── */
const ai = useAiAssessment()
const aiHtml = computed(() => renderMarkdown(ai.narrative.value))

/* ─── Turnstile 人机验证 ─────────────────────────────────────── */
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const turnstileEnabled = !!TURNSTILE_SITE_KEY
const turnstileToken = ref('')
const turnstileEl = ref(null)
let turnstileWidgetId = null

function renderTurnstile() {
  if (!turnstileEnabled || !window.turnstile || !turnstileEl.value || turnstileWidgetId !== null) return
  turnstileWidgetId = window.turnstile.render(turnstileEl.value, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: (token) => { turnstileToken.value = token },
    'expired-callback': () => { turnstileToken.value = '' },
    'error-callback': () => { turnstileToken.value = '' }
  })
}

function waitForTurnstile(tries = 0) {
  if (window.turnstile) { renderTurnstile(); return }
  if (tries > 50) return
  window.setTimeout(() => waitForTurnstile(tries + 1), 100)
}

function resetTurnstile() {
  turnstileToken.value = ''
  if (turnstileEnabled && window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId)
  }
}

// 报告区出现后再渲染验证组件（widget 在 v-if 内）
watch(showReport, async (v) => {
  if (v && turnstileEnabled) {
    await nextTick()
    waitForTurnstile()
  }
})

async function runAi() {
  if (turnstileEnabled && !turnstileToken.value) return
  await ai.run({
    patient: JSON.parse(JSON.stringify(patient)),
    calculated: result.value,
    locale: locale.value,
    turnstileToken: turnstileToken.value
  })
  resetTurnstile() // Turnstile token 单次有效，每次请求后重置
  window.setTimeout(() => {
    document.getElementById('ai-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}

function copyAiNarrative() {
  if (ai.narrative.value) navigator.clipboard?.writeText(ai.narrative.value)
}

/* ─── 管理员面板（普通用户看不见） ────────────────────────── */
const adminVisible    = ref(false)
const adminTokenInput = ref('')
const adminProvSel    = ref('')

onMounted(() => {
  adminTokenInput.value = getAdminToken()
  adminProvSel.value    = getAdminProvider() || ''
  // 管理员入口：URL 加 ?admin=1（query string 不受 hash 路由影响）
  const params = new URLSearchParams(window.location.search)
  if (params.get('admin') === '1') adminVisible.value = true
})

function toggleAdmin() {
  adminVisible.value = !adminVisible.value
}
function saveAdmin() {
  setAdminToken(adminTokenInput.value.trim())
  setAdminProvider(adminProvSel.value)
}
function clearAdmin() {
  setAdminToken('')
  setAdminProvider('')
  adminTokenInput.value = ''
  adminProvSel.value = ''
}
</script>

<template>
  <section class="page-head">
    <h1>{{ t('assessment.title') }}</h1>
    <p class="sub">{{ t('assessment.subtitle') }}</p>
    <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
      <button class="btn btn-outline btn-sm" @click="loadSample">{{ t('assessment.load_sample') }}</button>
      <button class="btn btn-outline btn-sm" @click="resetForm">{{ t('assessment.reset') }}</button>
      <button class="btn btn-sm" @click="runReport">{{ t('assessment.generate') }}</button>
    </div>
  </section>

  <!-- 表单区 -->
  <div class="card">
    <div class="section-title">{{ t('assessment.section_basic') }}</div>
    <div class="grid-form">
      <div class="field"><label>{{ t('assessment.f.name') }}</label>
        <input class="input" v-model="patient.patient_info.name" />
      </div>
      <div class="field"><label>{{ t('assessment.f.gender') }}</label>
        <select class="select" v-model="patient.patient_info.gender">
          <option value="male">{{ t('daily.male') }}</option>
          <option value="female">{{ t('daily.female') }}</option>
        </select>
      </div>
      <div class="field"><label>{{ t('assessment.f.age') }}</label>
        <input class="input" type="number" v-model.number="patient.patient_info.age" />
      </div>
      <div class="field"><label>{{ t('assessment.f.height') }}</label>
        <input class="input" type="number" v-model.number="patient.patient_info.height_cm" />
      </div>
      <div class="field"><label>{{ t('assessment.f.weight') }}</label>
        <input class="input" type="number" step="0.1" v-model.number="patient.patient_info.weight_kg" />
      </div>
      <div class="field"><label>{{ t('assessment.f.usual_weight') }}</label>
        <input class="input" type="number" step="0.1" v-model.number="patient.patient_info.usual_weight_kg" />
      </div>
      <div class="field"><label>{{ t('assessment.f.weight_loss_duration') }}</label>
        <input class="input" type="number" v-model.number="patient.patient_info.weight_loss_duration_months" />
      </div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">{{ t('assessment.section_history') }}</div>
    <div class="field"><label>{{ t('assessment.f.chief_complaint') }}</label>
      <textarea class="input" rows="2" v-model="patient.chief_complaint"></textarea>
    </div>
    <div class="field"><label>{{ t('assessment.f.present_illness') }}</label>
      <textarea class="input" rows="3" v-model="patient.present_illness"></textarea>
    </div>
    <div class="field"><label>{{ t('assessment.f.past_history') }}</label>
      <textarea class="input" rows="2" v-model="patient.past_history"></textarea>
    </div>
  </div>

  <div class="card">
    <div class="section-title">{{ t('assessment.section_diet') }}</div>
    <div class="grid-form">
      <div class="field"><label>{{ t('assessment.f.intake_pct') }}</label>
        <input class="input" type="number" min="0" max="100" v-model.number="patient.dietary_info.intake_percentage" />
      </div>
      <div class="field"><label>{{ t('assessment.f.restrictions') }}</label>
        <input class="input" v-model="patient.dietary_info.dietary_restrictions" :placeholder="t('assessment.ph.restrictions')" />
      </div>
      <div class="field"><label>{{ t('assessment.f.swallowing') }}</label>
        <select class="select" v-model="patient.dietary_info.swallowing_difficulty">
          <option value="">--</option>
          <option value="yes">{{ t('assessment.has') }}</option>
          <option value="no">{{ t('assessment.none') }}</option>
        </select>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">{{ t('assessment.section_labs') }}</div>
    <p class="muted" style="font-size: 13px; margin: 0 0 10px;">{{ t('assessment.labs_hint') }}</p>
    <div class="lab-grid">
      <div v-for="(lab, i) in patient.lab_results.biochemistry" :key="'b'+i" class="lab-row">
        <span class="lab-name">{{ labLabel(lab.name) }}</span>
        <input class="input" type="number" step="0.01" v-model.number="lab.value" />
        <span class="muted mono" style="font-size: 13px;">{{ lab.unit }}</span>
      </div>
      <div v-for="(lab, i) in patient.lab_results.complete_blood_count" :key="'c'+i" class="lab-row">
        <span class="lab-name">{{ labLabel(lab.name) }}</span>
        <input class="input" type="number" step="0.01" v-model.number="lab.value" />
        <span class="muted mono" style="font-size: 13px;">{{ lab.unit }}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">{{ t('assessment.section_risk') }}</div>
    <div class="grid-form">
      <div class="field">
        <label>{{ t('assessment.f.nrs2002') }}</label>
        <input class="input" type="number" min="0" max="7" v-model.number="patient.NRS2002_score" />
        <span class="muted" style="font-size: 12px;">{{ t('assessment.nrs_hint') }}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">{{ t('assessment.section_dx') }}</div>
    <div v-for="(d, i) in patient.diagnoses" :key="i" style="display: flex; gap: 8px; margin-bottom: 6px;">
      <input class="input" v-model="patient.diagnoses[i]" :placeholder="t('assessment.ph.diagnosis')" />
      <button v-if="patient.diagnoses.length > 1" class="btn btn-ghost btn-sm" @click="removeDiagnosis(i)">✕</button>
    </div>
    <button class="btn btn-outline btn-sm" @click="addDiagnosis">+ {{ t('assessment.add_dx') }}</button>
  </div>

  <div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 24px 0;">
    <button class="btn" @click="runReport">{{ t('assessment.generate') }}</button>
    <button class="btn btn-outline" @click="copyJson">{{ t('assessment.copy_json') }}</button>
  </div>

  <!-- 报告区 -->
  <div id="report-anchor"></div>
  <div v-if="showReport" class="card report">
    <div class="flex" style="align-items: flex-start; gap: 12px;">
      <h2 class="flex-1" style="margin-top: 0;">{{ t('assessment.report_title') }}</h2>
      <button class="btn btn-outline btn-sm" @click="copyReport">{{ t('assessment.copy_report') }}</button>
    </div>

    <!-- 摘要数字 -->
    <div class="hero-numbers" style="margin-top: 0;">
      <div class="stat">
        <div class="v">{{ result.bmi ?? '—' }}</div>
        <div class="k">BMI</div>
        <span v-if="result.bmiCategory" class="pill" :class="bmiTone(result.bmiCategory)" style="margin-top: 4px;">
          {{ t('assessment.bmi.' + result.bmiCategory.key) }}
        </span>
      </div>
      <div class="stat">
        <div class="v">{{ result.weightLoss != null && result.weightLoss > 0 ? result.weightLoss + '%' : '—' }}</div>
        <div class="k">{{ t('assessment.r.weight_loss') }}</div>
      </div>
      <div class="stat">
        <div class="v">{{ result.nrs2002 ? result.nrs2002.score : '—' }}</div>
        <div class="k">NRS2002</div>
        <span v-if="result.nrs2002" class="pill" :class="result.nrs2002.risk ? 'red' : 'pill'" style="margin-top: 4px;">
          {{ result.nrs2002.risk ? t('assessment.r.at_risk') : t('assessment.r.no_risk') }}
        </span>
      </div>
      <div class="stat">
        <div class="v" style="text-transform: capitalize;">{{ isZh ? stressLabel.zh : stressLabel.en }}</div>
        <div class="k">{{ t('assessment.r.stress') }}</div>
      </div>
    </div>

    <!-- GLIM -->
    <h3>{{ t('assessment.r.glim_title') }}</h3>
    <div v-if="result.glim.hasMalnutrition">
      <span class="pill red">{{ result.glim.severity === 'severe' ? t('assessment.r.severe_mal') : t('assessment.r.moderate_mal') }}</span>
      <div style="margin-top: 10px;" class="muted">
        <strong>{{ t('assessment.r.phenotype') }}：</strong>
        <span v-for="(p, i) in result.glim.phenotype" :key="i">
          {{ t('assessment.glim.' + p.key) }}({{ p.value }}<span v-if="p.key==='weight_loss'">%</span>)<span v-if="i < result.glim.phenotype.length - 1">、</span>
        </span>
        <br>
        <strong>{{ t('assessment.r.etiology') }}：</strong>
        <span v-for="(e, i) in result.glim.etiology" :key="i">
          {{ t('assessment.glim.' + e.key) }}<span v-if="e.value"> ({{ e.value }}%)</span><span v-if="i < result.glim.etiology.length - 1">、</span>
        </span>
      </div>
    </div>
    <p v-else class="muted">{{ t('assessment.r.no_malnutrition') }}</p>

    <!-- Energy & Protein -->
    <h3>{{ t('assessment.r.targets_title') }}</h3>
    <div class="nutri-table">
      <div class="nutri-row" v-if="result.energyTarget">
        <span class="key">{{ t('assessment.r.energy') }} ({{ result.energyTarget.per_kg[0] }}–{{ result.energyTarget.per_kg[1] }} kcal/kg/d)</span>
        <span class="val">{{ result.energyTarget.low }}–{{ result.energyTarget.high }} kcal/d</span>
      </div>
      <div class="nutri-row" v-if="result.proteinTarget">
        <span class="key">{{ t('assessment.r.protein') }} ({{ result.proteinTarget.per_kg[0] }}–{{ result.proteinTarget.per_kg[1] }} g/kg/d)</span>
        <span class="val">{{ result.proteinTarget.low }}–{{ result.proteinTarget.high }} g/d</span>
      </div>
    </div>

    <!-- PES -->
    <h3 v-if="result.pes.length">{{ t('assessment.r.pes_title') }}</h3>
    <div v-for="(p, i) in result.pes" :key="i" class="pes-card">
      <div><strong class="pes-p">{{ t('assessment.r.problem') }}：</strong> {{ isZh ? p.problem_zh : p.problem_en }}</div>
      <div><strong class="pes-e">{{ t('assessment.r.etiology_short') }}：</strong> {{ isZh ? p.etiology_zh : p.etiology_en }}</div>
      <div><strong class="pes-s">{{ t('assessment.r.signs') }}：</strong> {{ isZh ? p.signs_zh : p.signs_en }}</div>
    </div>

    <!-- Lab flags -->
    <h3 v-if="result.labFlags.length">{{ t('assessment.r.labs_title') }}</h3>
    <div class="nutri-table">
      <div v-for="(l, i) in result.labFlags" :key="i" class="nutri-row">
        <span class="key">
          {{ isZh ? l.name_zh : l.name_en }}
          <span class="muted mono" style="font-size: 12px;">{{ l.value }} {{ l.unit }}</span>
        </span>
        <span class="val" style="font-size: 13px; font-weight: 500;">
          <span class="pill" :class="l.status === 'severe' ? 'red' : 'amber'">{{ isZh ? l.comment_zh : l.comment_en }}</span>
        </span>
      </div>
    </div>

    <!-- Actions -->
    <h3>{{ t('assessment.r.actions_title') }}</h3>
    <ol class="action-list">
      <li v-for="(a, i) in result.actions" :key="i" v-html="(isZh ? a.zh : a.en).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')"></li>
    </ol>

    <!-- AI 深度解读分隔 -->
    <div class="ai-divider">
      <div class="ai-divider-line"></div>
      <div class="ai-pill">{{ t('assessment.ai.tier_label') }}</div>
      <div class="ai-divider-line"></div>
    </div>

    <div class="ai-cta">
      <div>
        <h3 style="margin: 0 0 6px;">{{ t('assessment.ai.title') }}</h3>
        <p class="muted" style="margin: 0; font-size: 14px;">{{ t('assessment.ai.subtitle') }}</p>
      </div>
      <div class="ai-cta-action">
        <div v-if="turnstileEnabled" ref="turnstileEl" class="turnstile-box"></div>
        <button class="btn" :disabled="ai.loading.value || (turnstileEnabled && !turnstileToken)" @click="runAi">
          <span v-if="!ai.loading.value">✨ {{ t('assessment.ai.run') }}</span>
          <span v-else>{{ t('assessment.ai.loading') }}</span>
        </button>
        <p v-if="turnstileEnabled && !turnstileToken" class="muted verify-hint">{{ t('assessment.ai.verify_hint') }}</p>
      </div>
    </div>

    <div id="ai-anchor"></div>

    <div v-if="ai.loading.value" class="ai-skeleton">
      <div class="bar w90"></div>
      <div class="bar w75"></div>
      <div class="bar w85"></div>
      <div class="bar w60"></div>
      <p class="muted" style="margin-top: 12px; font-size: 13px;">{{ t('assessment.ai.thinking') }}</p>
    </div>

    <div v-if="ai.error.value" class="ai-error">
      <strong>{{ t('assessment.ai.error_title') }}</strong>
      <div style="margin-top: 4px; font-size: 13px; color: var(--c-fg-mid);">{{ ai.error.value }}</div>
      <div style="margin-top: 8px; font-size: 12px; color: var(--c-fg-soft);">{{ t('assessment.ai.error_hint') }}</div>
    </div>

    <div v-if="ai.narrative.value && !ai.loading.value" class="ai-narrative">
      <div class="ai-meta">
        <span class="pill">{{ t('assessment.ai.powered_by') }} · {{ ai.provider.value }} / {{ ai.model.value }}</span>
        <button class="btn btn-ghost btn-sm" @click="copyAiNarrative">{{ t('assessment.copy_report') }}</button>
      </div>
      <div class="md-body" v-html="aiHtml"></div>
      <p class="muted" style="font-size: 12px; margin-top: 20px; padding-top: 14px; border-top: 1px dashed var(--c-border);">
        {{ t('assessment.ai.disclaimer') }}
      </p>
    </div>
  </div>

  <ToolContent ns="assessment" />

  <!-- 管理员面板：访问 #admin 时可见 -->
  <div v-if="adminVisible" class="admin-panel card">
    <div class="section-title">{{ t('admin.title') }}</div>
    <p class="muted" style="font-size: 13px; margin: 0 0 12px;">{{ t('admin.hint') }}</p>
    <div class="field">
      <label>{{ t('admin.token') }}</label>
      <input class="input" type="password" v-model="adminTokenInput" autocomplete="off" />
    </div>
    <div class="field">
      <label>{{ t('admin.provider') }}</label>
      <select class="select" v-model="adminProvSel">
        <option value="">{{ t('admin.provider_default') }}</option>
        <option value="deepseek">DeepSeek</option>
        <option value="minimax">MiniMax</option>
        <option value="glm">GLM (ZhipuAI)</option>
      </select>
    </div>
    <div style="display: flex; gap: 8px; margin-top: 12px;">
      <button class="btn btn-sm" @click="saveAdmin">{{ t('common.save') }}</button>
      <button class="btn btn-outline btn-sm" @click="clearAdmin">{{ t('common.clear') }}</button>
      <button class="btn btn-ghost btn-sm" @click="toggleAdmin">{{ t('common.close') }}</button>
    </div>
  </div>
</template>

<style scoped>
.grid-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 720px) {
  .grid-form { grid-template-columns: repeat(3, 1fr); }
}
.lab-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
@media (min-width: 720px) {
  .lab-grid { grid-template-columns: 1fr 1fr; }
}
.lab-row {
  display: grid;
  grid-template-columns: 130px 1fr 80px;
  gap: 8px;
  align-items: center;
}
.lab-name { font-size: 14px; color: var(--c-fg); }
.report h3 { margin-top: 24px; font-size: 16px; }
.pes-card {
  padding: 12px 14px;
  border-left: 3px solid var(--c-primary);
  background: #fbfaf5;
  border-radius: 6px;
  margin-bottom: 10px;
  font-size: 14px;
}
.pes-p { color: var(--c-danger); }
.pes-e { color: #a16207; }
.pes-s { color: var(--c-primary-strong); }
.action-list {
  padding-left: 20px;
  line-height: 1.85;
}
.action-list li { margin-bottom: 6px; }
.action-list strong { color: var(--c-fg); background: #fef3c7; padding: 1px 5px; border-radius: 3px; }

/* ─── AI 深度解读区段 ────────────────────────────────── */
.ai-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 40px 0 20px;
}
.ai-divider-line {
  flex: 1;
  height: 1px;
  background: var(--c-border);
}
.ai-pill {
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--c-primary-strong);
  letter-spacing: 0.6px;
  text-transform: uppercase;
}
.ai-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #fdf6ed 0%, #f7eee2 100%);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius);
  margin-bottom: 14px;
}
@media (max-width: 600px) {
  .ai-cta { flex-direction: column; align-items: flex-start; }
}
.ai-cta-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
@media (max-width: 600px) {
  .ai-cta-action { align-items: flex-start; width: 100%; }
}
.turnstile-box { min-height: 65px; }
.verify-hint { font-size: 12px; margin: 0; }
.ai-skeleton {
  background: var(--c-bg-warm);
  border-radius: var(--radius-sm);
  padding: 20px;
  margin-bottom: 14px;
}
.ai-skeleton .bar {
  height: 12px;
  background: linear-gradient(90deg, #eee5d4 0%, #f5ecdc 50%, #eee5d4 100%);
  background-size: 200% 100%;
  border-radius: 6px;
  margin-bottom: 10px;
  animation: shimmer 1.4s infinite linear;
}
.ai-skeleton .w90 { width: 90%; }
.ai-skeleton .w75 { width: 75%; }
.ai-skeleton .w85 { width: 85%; }
.ai-skeleton .w60 { width: 60%; }
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

.ai-error {
  padding: 14px 16px;
  background: var(--c-danger-soft);
  border-left: 3px solid var(--c-danger);
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
  font-size: 14px;
}

.ai-narrative {
  padding: 22px 24px;
  background: #fefcf6;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  margin-bottom: 14px;
}
.ai-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--c-border);
}

/* AI markdown 渲染样式 */
.md-body { font-size: 15px; line-height: 1.78; color: var(--c-fg); }
.md-body h1, .md-body h2, .md-body h3, .md-body h4 {
  font-family: var(--font-serif);
  color: var(--c-fg);
  letter-spacing: -0.01em;
}
.md-body h2 { font-size: 20px; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--c-border); }
.md-body h3 { font-size: 17px; margin: 22px 0 10px; color: var(--c-primary-strong); }
.md-body h4 { font-size: 15px; margin: 16px 0 8px; }
.md-body p  { margin: 10px 0; }
.md-body ul, .md-body ol { padding-left: 22px; margin: 10px 0; }
.md-body li { margin: 4px 0; }
.md-body strong { color: var(--c-fg); }
.md-body blockquote {
  margin: 10px 0;
  padding: 8px 14px;
  background: #fbf7ee;
  border-left: 3px solid var(--c-primary);
  border-radius: 0 6px 6px 0;
  font-size: 14px;
}
.md-body code { background: var(--c-bg-warm); padding: 1px 5px; border-radius: 4px; font-size: 13px; font-family: var(--font-mono); }
.md-body .md-pre { background: var(--c-bg-warm); padding: 12px 14px; border-radius: 8px; overflow: auto; font-size: 13px; }
.md-body .md-pre code { background: transparent; padding: 0; }
.md-body .md-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14px; }
.md-body .md-table th, .md-body .md-table td { padding: 8px 12px; border: 1px solid var(--c-border); text-align: left; }
.md-body .md-table th { background: var(--c-bg-warm); font-weight: 600; }

/* 管理员面板 */
.admin-panel {
  margin-top: 30px;
  border: 2px dashed var(--c-amber);
  background: #fefbef;
}
.admin-panel .section-title { color: var(--c-amber); }
</style>
