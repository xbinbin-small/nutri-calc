<script setup>
import { reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dri from '../data/dri.json'
import ToolContent from '../components/ToolContent.vue'

const { t, locale } = useI18n()

const STORE_KEY = 'nutri.daily.profile.v1'
const initial = (() => {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { sex: 'male', age: 30, weight: 70, height: 175, activity: 'light', goal: 'maintain' }
})()

const profile = reactive(initial)

watch(profile, (v) => localStorage.setItem(STORE_KEY, JSON.stringify(v)), { deep: true })

const isZh = computed(() => locale.value === 'zh-CN')

// Mifflin-St Jeor
const bmr = computed(() => {
  const base = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age
  return Math.round(profile.sex === 'male' ? base + 5 : base - 161)
})

const tdee = computed(() => {
  const factor = dri.activity_factor[profile.activity]?.value || 1.375
  return Math.round(bmr.value * factor)
})

const target = computed(() => {
  if (profile.goal === 'loss') return Math.round(tdee.value * 0.85)
  if (profile.goal === 'gain') return Math.round(tdee.value * 1.10)
  return tdee.value
})

const macros = computed(() => {
  const cal = target.value
  // mid-point of AMDR
  const pPct = (dri.amdr.protein_pct.min + dri.amdr.protein_pct.max) / 2 / 100
  const fPct = (dri.amdr.fat_pct.min + dri.amdr.fat_pct.max) / 2 / 100
  const cPct = (dri.amdr.carbs_pct.min + dri.amdr.carbs_pct.max) / 2 / 100
  return {
    protein: Math.round((cal * pPct) / 4),
    fat:     Math.round((cal * fPct) / 9),
    carbs:   Math.round((cal * cPct) / 4)
  }
})

const micros = computed(() =>
  dri.micronutrients_adult.map((m) => ({
    key: m.key,
    name: isZh.value ? m.name_zh : m.name_en,
    unit: m.unit,
    rda: profile.sex === 'male' ? m.rda_male : m.rda_female
  }))
)

const activityOptions = computed(() =>
  Object.entries(dri.activity_factor).map(([k, v]) => ({
    value: k,
    label: isZh.value ? v.name_zh : v.name_en,
    factor: v.value
  }))
)
</script>

<template>
  <section class="page-head">
    <h1>{{ t('daily.title') }}</h1>
    <p class="sub">{{ t('daily.subtitle') }}</p>
  </section>

  <div class="grid grid-2">
    <div class="card">
      <h2>{{ t('daily.calc') }}</h2>

      <div class="field-row">
        <div class="field">
          <label>{{ t('daily.sex') }}</label>
          <select class="select" v-model="profile.sex">
            <option value="male">{{ t('daily.male') }}</option>
            <option value="female">{{ t('daily.female') }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('daily.age') }}</label>
          <input class="input" type="number" min="1" max="120" v-model.number="profile.age" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>{{ t('daily.weight') }}</label>
          <input class="input" type="number" min="20" max="300" step="0.1" v-model.number="profile.weight" />
        </div>
        <div class="field">
          <label>{{ t('daily.height') }}</label>
          <input class="input" type="number" min="80" max="230" step="0.1" v-model.number="profile.height" />
        </div>
      </div>

      <div class="field">
        <label>{{ t('daily.activity') }}</label>
        <select class="select" v-model="profile.activity">
          <option v-for="o in activityOptions" :key="o.value" :value="o.value">
            {{ o.label }} (×{{ o.factor }})
          </option>
        </select>
      </div>

      <div class="field">
        <label>{{ t('daily.goal') }}</label>
        <select class="select" v-model="profile.goal">
          <option value="maintain">{{ t('daily.goal_maintain') }}</option>
          <option value="loss">{{ t('daily.goal_loss') }}</option>
          <option value="gain">{{ t('daily.goal_gain') }}</option>
        </select>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>{{ t('common.result') }}</h2>
        <div class="hero-numbers">
          <div class="stat">
            <div class="v">{{ bmr }}</div>
            <div class="k">{{ t('daily.bmr') }} ({{ t('daily.unit_kcal') }})</div>
          </div>
          <div class="stat">
            <div class="v">{{ tdee }}</div>
            <div class="k">{{ t('daily.tdee') }} ({{ t('daily.unit_kcal') }})</div>
          </div>
          <div class="stat">
            <div class="v">{{ target }}</div>
            <div class="k">{{ t('daily.target_calories') }} ({{ t('daily.unit_kcal') }})</div>
          </div>
          <div class="stat">
            <div class="v">{{ macros.protein }} g</div>
            <div class="k">{{ t('nutrients.protein') }}</div>
          </div>
        </div>

        <h3>{{ t('daily.macros_title') }}</h3>
        <div class="nutri-table">
          <div class="nutri-row">
            <span class="key">{{ t('nutrients.protein') }}</span>
            <span class="val">{{ macros.protein }} g</span>
          </div>
          <div class="nutri-row">
            <span class="key">{{ t('nutrients.fat') }}</span>
            <span class="val">{{ macros.fat }} g</span>
          </div>
          <div class="nutri-row">
            <span class="key">{{ t('nutrients.carbs') }}</span>
            <span class="val">{{ macros.carbs }} g</span>
          </div>
        </div>

        <h3 style="margin-top: 18px;">{{ t('daily.micros_title') }}</h3>
        <div class="nutri-table">
          <div v-for="m in micros" :key="m.key" class="nutri-row">
            <span class="key">{{ m.name }}</span>
            <span class="val">{{ m.rda }} {{ m.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ToolContent ns="daily" />
</template>
