<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import fsmp from '../data/fsmp.json'
import conditions from '../data/conditions.json'
import { useCalcStore } from '../composables/useCalcStore.js'
import ToolContent from '../components/ToolContent.vue'

const { t, locale } = useI18n()
const store = useCalcStore()

const query = ref('')
const indication = ref('all')
const cat = ref('all')

const isZh = computed(() => locale.value === 'zh-CN')

const conditionList = computed(() => [
  { id: 'all', name_zh: t('common.all'), name_en: t('common.all'), icon: '🌐' },
  ...conditions
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return fsmp.filter((p) => {
    if (indication.value !== 'all' && !p.indications.includes(indication.value)) return false
    if (cat.value !== 'all' && p.category !== cat.value) return false
    if (!q) return true
    return (
      p.name_zh.toLowerCase().includes(q) ||
      p.name_en.toLowerCase().includes(q) ||
      (p.brand_zh || '').toLowerCase().includes(q) ||
      (p.brand_en || '').toLowerCase().includes(q)
    )
  })
})

const selected = ref(null)
const dose = ref(1)

function openDetail(p) {
  selected.value = p
  dose.value = 1
}
function closeDetail() {
  selected.value = null
}
function addFromModal() {
  if (selected.value) {
    store.addFsmp(selected.value, dose.value)
    closeDetail()
  }
}

function nameOf(p)  { return isZh.value ? p.name_zh   : p.name_en }
function brandOf(p) { return isZh.value ? p.brand_zh  : p.brand_en }
function pkgOf(p)   { return isZh.value ? p.package_zh : p.package_en }
function servOf(p)  { return isZh.value ? p.serving_zh : p.serving_en }
function notesOf(p) { return isZh.value ? p.notes_zh   : p.notes_en }
function featuresOf(p) { return isZh.value ? p.features_zh : p.features_en }
function contraOf(p)  { return isZh.value ? p.contraindications_zh : p.contraindications_en }
function conditionName(id) {
  const c = conditions.find((x) => x.id === id)
  if (!c) return id
  return isZh.value ? c.name_zh : c.name_en
}
function categoryLabel(c) {
  if (c === 'complete') return t('common.category_complete')
  if (c === 'specific') return t('common.category_specific')
  return t('common.category_non_complete')
}
function formLabel(f) {
  if (f === 'powder') return t('common.form_powder')
  if (f === 'liquid') return t('common.form_liquid')
  return t('common.form_semi_solid')
}

const doseEstimate = computed(() => {
  if (!selected.value) return { kcal: 0, p: 0 }
  const ps = selected.value.per_serving
  return {
    kcal: Math.round((ps.calories || 0) * dose.value * 10) / 10,
    p:    Math.round((ps.protein  || 0) * dose.value * 10) / 10
  }
})
</script>

<template>
  <section class="page-head">
    <h1>{{ t('fsmp.title') }}</h1>
    <p class="sub">{{ t('fsmp.subtitle') }}</p>
  </section>

  <div class="notice">{{ t('fsmp.sample_notice') }}</div>

  <div class="card" style="margin-bottom: 18px;">
    <div class="search-bar">
      <input class="input" :placeholder="t('fsmp.search_placeholder')" v-model="query" />
      <select class="select" v-model="indication" style="max-width: 220px;">
        <option v-for="c in conditionList" :key="c.id" :value="c.id">
          {{ c.icon }} {{ isZh ? c.name_zh : c.name_en }}
        </option>
      </select>
      <select class="select" v-model="cat" style="max-width: 220px;">
        <option value="all">{{ t('common.all') }}</option>
        <option value="complete">{{ t('common.category_complete') }}</option>
        <option value="specific">{{ t('common.category_specific') }}</option>
        <option value="non-complete">{{ t('common.category_non_complete') }}</option>
      </select>
    </div>
    <div class="muted" style="font-size: 13px;">{{ t('fsmp.show_count', { n: filtered.length }) }}</div>
  </div>

  <div class="fsmp-grid">
    <div v-for="p in filtered" :key="p.id" class="fsmp-card">
      <h3>{{ nameOf(p) }}</h3>
      <div class="brand">{{ brandOf(p) }}</div>
      <div v-if="p.registration_no" class="reg-no muted mono">{{ p.registration_no }}</div>
      <div>
        <span class="pill blue">{{ categoryLabel(p.category) }}</span>
        <span class="pill gray">{{ formLabel(p.form) }}</span>
        <span v-if="p.market" class="pill gray">{{ t('fsmp_market.' + p.market) }}</span>
        <span v-for="ind in p.indications" :key="ind" class="pill">{{ conditionName(ind) }}</span>
      </div>
      <div class="quick">
        <div class="q-item"><b>{{ p.per_serving.calories }}</b> kcal</div>
        <div class="q-item"><b>{{ p.per_serving.protein }}</b> g protein</div>
        <div class="q-item"><b>{{ p.per_serving.amount }}</b> {{ p.form === 'liquid' ? 'mL' : 'g' }}</div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button class="btn btn-outline btn-sm flex-1" @click="openDetail(p)">{{ t('fsmp.view_detail') }}</button>
        <button class="btn btn-sm flex-1" @click="store.addFsmp(p)">{{ t('fsmp.add_to_calc') }}</button>
      </div>
    </div>
    <div v-if="filtered.length === 0" class="muted card" style="grid-column: 1/-1; text-align: center;">
      {{ t('common.no_data') }}
    </div>
  </div>

  <ToolContent ns="fsmp" />

  <!-- Detail modal -->
  <div v-if="selected" class="modal-mask" @click.self="closeDetail">
    <div class="modal">
      <div class="close">
        <button class="btn-ghost btn btn-sm" @click="closeDetail">✕ {{ t('common.close') }}</button>
      </div>
      <h2>{{ nameOf(selected) }}</h2>
      <div class="muted">{{ brandOf(selected) }} · {{ pkgOf(selected) }}</div>
      <div style="margin: 12px 0;">
        <span class="pill blue">{{ categoryLabel(selected.category) }}</span>
        <span class="pill gray">{{ formLabel(selected.form) }}</span>
        <span v-if="selected.market" class="pill gray">{{ t('fsmp_market.' + selected.market) }}</span>
        <span v-for="ind in selected.indications" :key="ind" class="pill">{{ conditionName(ind) }}</span>
      </div>

      <div v-if="selected.regulatory_category || selected.registration_no" class="section-title">{{ t('fsmp.product_info') }}</div>
      <div v-if="selected.regulatory_category || selected.registration_no" class="nutri-table">
        <div v-if="selected.regulatory_category" class="nutri-row">
          <span class="key">{{ t('fsmp.regulatory') }}</span>
          <span class="val">{{ t('fsmp_regulatory.' + selected.regulatory_category) }}</span>
        </div>
        <div v-if="selected.registration_no" class="nutri-row">
          <span class="key">{{ t('fsmp.registration_no') }}</span>
          <span class="val mono">{{ selected.registration_no }}</span>
        </div>
      </div>

      <div class="section-title">{{ t('common.serving') }}</div>
      <div>{{ servOf(selected) }}</div>

      <div class="section-title">{{ t('common.per_serving') }}</div>
      <div class="nutri-table">
        <div class="nutri-row"><span class="key">{{ t('nutrients.calories') }}</span><span class="val">{{ selected.per_serving.calories }}</span></div>
        <div class="nutri-row"><span class="key">{{ t('nutrients.protein') }}</span><span class="val">{{ selected.per_serving.protein }}</span></div>
        <div class="nutri-row"><span class="key">{{ t('nutrients.fat') }}</span><span class="val">{{ selected.per_serving.fat }}</span></div>
        <div class="nutri-row"><span class="key">{{ t('nutrients.carbs') }}</span><span class="val">{{ selected.per_serving.carbs }}</span></div>
        <div class="nutri-row" v-if="selected.per_serving.fiber != null"><span class="key">{{ t('nutrients.fiber') }}</span><span class="val">{{ selected.per_serving.fiber }}</span></div>
        <div class="nutri-row" v-if="selected.per_serving.sodium != null"><span class="key">{{ t('nutrients.sodium') }}</span><span class="val">{{ selected.per_serving.sodium }}</span></div>
        <div class="nutri-row" v-if="selected.per_serving.potassium != null"><span class="key">{{ t('nutrients.potassium') }}</span><span class="val">{{ selected.per_serving.potassium }}</span></div>
        <div class="nutri-row" v-if="selected.per_serving.calcium != null"><span class="key">{{ t('nutrients.calcium') }}</span><span class="val">{{ selected.per_serving.calcium }}</span></div>
      </div>

      <div class="section-title">{{ t('common.features') }}</div>
      <div>
        <span v-for="f in featuresOf(selected)" :key="f" class="pill">{{ f }}</span>
      </div>

      <div class="section-title">{{ t('common.contraindications') }}</div>
      <div>{{ contraOf(selected) }}</div>

      <div class="section-title">{{ t('common.notes') }}</div>
      <div class="muted">{{ notesOf(selected) }}</div>

      <div class="section-title">{{ t('fsmp.dose_title') }}</div>
      <div class="flex gap-12" style="align-items: center;">
        <input type="number" min="0.25" step="0.25" class="input" style="max-width: 110px;" v-model.number="dose" />
        <span class="muted">{{ t('fsmp.dose_per_day') }}</span>
      </div>
      <div style="margin-top: 8px;">
        {{ t('fsmp.dose_result', { kcal: doseEstimate.kcal, p: doseEstimate.p }) }}
      </div>

      <div v-if="selected.source || selected.nutrition_basis" class="section-title">{{ t('fsmp.source_title') }}</div>
      <div v-if="selected.source || selected.nutrition_basis" class="source-info muted">
        <div v-if="selected.source">
          <a v-if="selected.source.url" :href="selected.source.url" target="_blank" rel="noopener">{{ selected.source.name }}</a>
          <span v-else>{{ selected.source.name }}</span>
        </div>
        <div v-if="selected.nutrition_basis">
          {{ t('fsmp.nutrition_basis') }}：{{ t('fsmp_basis.' + selected.nutrition_basis) }}
        </div>
        <div v-if="selected.source && selected.source.label_revision">
          {{ t('fsmp.label_revision') }}：{{ selected.source.label_revision }}
        </div>
        <div v-if="selected.source && selected.source.accessed_at">
          {{ t('fsmp.accessed_at') }}：{{ selected.source.accessed_at }}
        </div>
      </div>

      <div style="margin-top: 18px; display: flex; gap: 8px;">
        <button class="btn flex-1" @click="addFromModal">+ {{ t('fsmp.add_to_calc') }}</button>
        <button class="btn btn-outline flex-1" @click="closeDetail">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>
