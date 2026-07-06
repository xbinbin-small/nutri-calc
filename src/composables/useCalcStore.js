import { reactive, computed, watch } from 'vue'

const STORAGE_KEY = 'nutri.calc.items.v1'

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const state = reactive({
  items: loadInitial()
})

watch(
  () => state.items,
  (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)),
  { deep: true }
)

function makeKey(prefix, id) {
  return `${prefix}:${id}`
}

function addFood(food, amount = 100) {
  const key = makeKey('food', food.id)
  const existing = state.items.find((i) => i.key === key)
  if (existing) {
    existing.amount += amount
    return
  }
  state.items.push({
    key,
    kind: 'food',
    id: food.id,
    name_zh: food.name_zh,
    name_en: food.name_en,
    per: food.per,
    unit: food.unit,
    amount,
    nutrition: pickNutrition(food)
  })
}

function addFsmp(product, servings = 1) {
  const key = makeKey('fsmp', product.id)
  const existing = state.items.find((i) => i.key === key)
  const servingAmount = product.per_serving?.amount ?? 100
  if (existing) {
    existing.servings += servings
    existing.amount = existing.servings * servingAmount
    return
  }
  state.items.push({
    key,
    kind: 'fsmp',
    id: product.id,
    name_zh: product.name_zh,
    name_en: product.name_en,
    per: servingAmount,
    unit: product.form === 'liquid' ? 'mL' : 'g',
    amount: servings * servingAmount,
    servings,
    nutrition: pickNutrition(product.per_serving),
    perServing: product.per_serving
  })
}

function pickNutrition(src = {}) {
  return {
    calories: +src.calories || 0,
    protein:  +src.protein  || 0,
    fat:      +src.fat      || 0,
    carbs:    +src.carbs    || 0,
    fiber:    +src.fiber    || 0,
    sugar:    +src.sugar    || 0,
    sodium:   +src.sodium   || 0,
    potassium:+src.potassium|| 0,
    calcium:  +src.calcium  || 0
  }
}

function updateAmount(key, amount) {
  const it = state.items.find((i) => i.key === key)
  if (!it) return
  const v = Math.max(0, +amount || 0)
  it.amount = v
  if (it.kind === 'fsmp' && it.perServing?.amount) {
    it.servings = +(v / it.perServing.amount).toFixed(2)
  }
}

function remove(key) {
  const idx = state.items.findIndex((i) => i.key === key)
  if (idx >= 0) state.items.splice(idx, 1)
}

function clear() {
  state.items = []
}

const totals = computed(() => {
  const t = {
    calories: 0, protein: 0, fat: 0, carbs: 0,
    fiber: 0, sugar: 0, sodium: 0, potassium: 0, calcium: 0
  }
  for (const it of state.items) {
    const factor = it.amount / it.per
    for (const k of Object.keys(t)) {
      t[k] += (it.nutrition[k] || 0) * factor
    }
  }
  for (const k of Object.keys(t)) t[k] = Math.round(t[k] * 10) / 10
  return t
})

const macroRatios = computed(() => {
  const { protein, fat, carbs } = totals.value
  const pCal = protein * 4
  const fCal = fat * 9
  const cCal = carbs * 4
  const sum = pCal + fCal + cCal
  if (!sum) return { p: 0, f: 0, c: 0 }
  return {
    p: Math.round((pCal / sum) * 100),
    f: Math.round((fCal / sum) * 100),
    c: Math.round((cCal / sum) * 100)
  }
})

export function useCalcStore() {
  return {
    items: computed(() => state.items),
    totals,
    macroRatios,
    addFood,
    addFsmp,
    updateAmount,
    remove,
    clear
  }
}
