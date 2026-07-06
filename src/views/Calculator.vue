<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import foods from '../data/foods.json'
import fsmp from '../data/fsmp.json'
import driRaw from '../data/dri.json'
import { useCalcStore } from '../composables/useCalcStore.js'
import FeaturedArticles from '../components/FeaturedArticles.vue'
import ToolContent from '../components/ToolContent.vue'

const { t, locale } = useI18n()
const store = useCalcStore()

const tab = ref('food')
const query = ref('')
const category = ref('all')

const isZh = computed(() => locale.value === 'zh-CN')

const foodCategories = computed(() => {
  const set = new Set(foods.map((f) => f.category))
  return ['all', ...Array.from(set)]
})

const filteredFoods = computed(() => {
  const q = query.value.trim().toLowerCase()
  return foods.filter((f) => {
    if (category.value !== 'all' && f.category !== category.value) return false
    if (!q) return true
    return (
      f.name_zh.toLowerCase().includes(q) ||
      f.name_en.toLowerCase().includes(q) ||
      f.id.includes(q)
    )
  })
})

const filteredFsmp = computed(() => {
  const q = query.value.trim().toLowerCase()
  return fsmp.filter((p) => {
    if (!q) return true
    return (
      p.name_zh.toLowerCase().includes(q) ||
      p.name_en.toLowerCase().includes(q) ||
      (p.brand_zh || '').toLowerCase().includes(q) ||
      (p.brand_en || '').toLowerCase().includes(q)
    )
  })
})

function nameOf(it) {
  return isZh.value ? it.name_zh : it.name_en
}

function brandOf(it) {
  return isZh.value ? it.brand_zh : it.brand_en
}

const nutrientKeys = ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium']

const amdr = driRaw.amdr

const advice = computed(() => {
  const tips = []
  const tot = store.totals.value
  if (tot.calories === 0) return tips
  if (tot.sodium > 1500) tips.push({ type: 'red', text: t('calculator.advice_high_sodium') })
  if (tot.fiber < 8 && tot.calories > 400) tips.push({ type: 'amber', text: t('calculator.advice_low_fiber') })
  if (tot.sugar > 25) tips.push({ type: 'amber', text: t('calculator.advice_high_sugar') })
  if (tips.length === 0) tips.push({ type: 'pill', text: t('calculator.advice_balanced') })
  return tips
})
</script>

<template>
  <section class="page-head">
    <h1>{{ t('calculator.title') }}</h1>
    <p class="sub">{{ t('calculator.subtitle') }}</p>
  </section>

  <div class="grid grid-2">
    <!-- Left: pick foods -->
    <div class="card">
      <div class="tabs" style="margin-bottom: 14px;">
        <button :class="{ active: tab === 'food' }" @click="tab = 'food'">{{ t('calculator.tab_food') }}</button>
        <button :class="{ active: tab === 'fsmp' }" @click="tab = 'fsmp'">{{ t('calculator.tab_fsmp') }}</button>
      </div>

      <div class="search-bar">
        <input
          class="input"
          :placeholder="t('common.search')"
          v-model="query"
        />
        <select v-if="tab === 'food'" class="select" v-model="category" style="max-width: 160px;">
          <option v-for="c in foodCategories" :key="c" :value="c">
            {{ c === 'all' ? t('common.all') : t('food_categories.' + c) }}
          </option>
        </select>
      </div>

      <div v-if="tab === 'food'" class="food-list">
        <div
          v-for="f in filteredFoods"
          :key="f.id"
          class="food-item"
          @click="store.addFood(f)"
        >
          <div class="label">
            <div>{{ nameOf(f) }}</div>
            <div class="cat">
              {{ t('food_categories.' + f.category) }} · {{ f.calories }} kcal / 100 {{ f.unit }}
            </div>
          </div>
          <button class="btn btn-outline btn-sm" @click.stop="store.addFood(f)">+ {{ t('common.add') }}</button>
        </div>
        <div v-if="filteredFoods.length === 0" class="muted" style="padding: 24px; text-align: center;">
          {{ t('common.no_data') }}
        </div>
      </div>

      <div v-else class="food-list">
        <div
          v-for="p in filteredFsmp"
          :key="p.id"
          class="food-item"
          @click="store.addFsmp(p)"
        >
          <div class="label">
            <div>{{ nameOf(p) }}</div>
            <div class="cat">
              {{ brandOf(p) }} · {{ p.per_serving.calories }} kcal / {{ t('common.per_serving') }}
            </div>
          </div>
          <button class="btn btn-outline btn-sm" @click.stop="store.addFsmp(p)">+ {{ t('common.add') }}</button>
        </div>
        <div v-if="filteredFsmp.length === 0" class="muted" style="padding: 24px; text-align: center;">
          {{ t('common.no_data') }}
        </div>
      </div>
    </div>

    <!-- Right: selected + summary -->
    <div>
      <div class="card">
        <div class="flex" style="align-items: center;">
          <h2 class="flex-1">{{ t('calculator.selected') }}</h2>
          <button v-if="store.items.value.length" class="btn-ghost btn btn-sm" @click="store.clear()">
            {{ t('calculator.btn_clear') }}
          </button>
        </div>

        <div v-if="store.items.value.length === 0" class="muted" style="padding: 24px; text-align: center;">
          {{ t('calculator.empty') }}
        </div>

        <div v-else>
          <div v-for="it in store.items.value" :key="it.key" class="row">
            <div class="name">
              {{ nameOf(it) }}
              <span class="pill gray" v-if="it.kind === 'fsmp'">FSMP</span>
            </div>
            <input
              type="number" min="0" step="1"
              class="input amount-input"
              :value="it.amount"
              @input="(e) => store.updateAmount(it.key, e.target.value)"
            />
            <span class="meta">{{ it.unit }}</span>
            <button class="btn btn-ghost btn-sm" @click="store.remove(it.key)">✕</button>
          </div>
        </div>
      </div>

      <div v-if="store.items.value.length > 0" class="card">
        <h2>{{ t('calculator.summary_title') }}</h2>

        <div class="hero-numbers">
          <div class="stat">
            <div class="v">{{ store.totals.value.calories }}</div>
            <div class="k">{{ t('nutrients.calories') }}</div>
          </div>
          <div class="stat">
            <div class="v">{{ store.totals.value.protein }}</div>
            <div class="k">{{ t('nutrients.protein') }}</div>
          </div>
          <div class="stat">
            <div class="v">{{ store.totals.value.fat }}</div>
            <div class="k">{{ t('nutrients.fat') }}</div>
          </div>
          <div class="stat">
            <div class="v">{{ store.totals.value.carbs }}</div>
            <div class="k">{{ t('nutrients.carbs') }}</div>
          </div>
        </div>

        <h3 style="margin-top: 18px;">{{ t('calculator.energy_ratio') }}</h3>
        <div class="muted" style="font-size: 13px;">
          {{ t('calculator.amdr_hint', { p: amdr.protein_pct.min + '-' + amdr.protein_pct.max, f: amdr.fat_pct.min + '-' + amdr.fat_pct.max, c: amdr.carbs_pct.min + '-' + amdr.carbs_pct.max }) }}
        </div>
        <div class="sp-y" style="margin-top: 10px;">
          <div>
            <div class="flex" style="justify-content: space-between;">
              <span>{{ t('nutrients.protein') }}</span>
              <span class="mono">{{ store.macroRatios.value.p }}%</span>
            </div>
            <div class="bar"><span :style="{ width: store.macroRatios.value.p + '%' }"></span></div>
          </div>
          <div>
            <div class="flex" style="justify-content: space-between;">
              <span>{{ t('nutrients.fat') }}</span>
              <span class="mono">{{ store.macroRatios.value.f }}%</span>
            </div>
            <div class="bar"><span :style="{ width: store.macroRatios.value.f + '%' }"></span></div>
          </div>
          <div>
            <div class="flex" style="justify-content: space-between;">
              <span>{{ t('nutrients.carbs') }}</span>
              <span class="mono">{{ store.macroRatios.value.c }}%</span>
            </div>
            <div class="bar"><span :style="{ width: store.macroRatios.value.c + '%' }"></span></div>
          </div>
        </div>

        <h3 style="margin-top: 18px;">{{ t('common.details') }}</h3>
        <div class="nutri-table">
          <div v-for="k in nutrientKeys" :key="k" class="nutri-row">
            <span class="key">{{ t('nutrients.' + k) }}</span>
            <span class="val">{{ store.totals.value[k] }}</span>
          </div>
        </div>

        <h3 style="margin-top: 18px;">{{ t('calculator.advice_title') }}</h3>
        <div>
          <span v-for="(a, i) in advice" :key="i" class="pill" :class="a.type">{{ a.text }}</span>
        </div>
      </div>
    </div>
  </div>

  <ToolContent ns="calculator" />

  <FeaturedArticles />
</template>
