/**
 * 临床营养评估纯计算逻辑（基于参考仓库 nutrition-and-foodplan 的临床标准）
 * Clinical nutrition assessment logic — pure functions, no IO.
 * 输入 patient 对象，输出结构化评估结果。
 */

export function calcBMI(height_cm, weight_kg) {
  if (!height_cm || !weight_kg) return null
  const m = height_cm / 100
  return +(weight_kg / (m * m)).toFixed(1)
}

export function bmiCategory(bmi, age = 30) {
  if (bmi == null) return null
  // 中国成人 BMI 分级；老年人使用更严格阈值（GLIM 70 岁分界）
  if (age >= 70) {
    if (bmi < 20) return { key: 'glim_low_elder',  severity: 'phenotype_low_bmi' }
    if (bmi < 22) return { key: 'low_elder_alert', severity: 'mild' }
  } else if (age >= 65) {
    if (bmi < 20) return { key: 'low_elder',   severity: 'mild' }
  }
  if (bmi < 18.5) return { key: 'underweight', severity: 'severe' }
  if (bmi < 24.0) return { key: 'normal',      severity: 'normal' }
  if (bmi < 28.0) return { key: 'overweight',  severity: 'mild'  }
  return { key: 'obese', severity: 'severe' }
}

export function weightLossPct(usual_weight, current_weight) {
  if (!usual_weight || !current_weight) return null
  return +(((usual_weight - current_weight) / usual_weight) * 100).toFixed(1)
}

export function weightLossSeverity(pct, durationMonths) {
  if (pct == null || pct <= 0) return null
  const d = durationMonths || 6
  // 显著下降阈值
  const thresholds = { 1: 5, 3: 7.5, 6: 10 }
  const refMonths = d <= 1 ? 1 : d <= 3 ? 3 : 6
  const threshold = thresholds[refMonths]
  if (pct >= threshold * 2) return 'severe'
  if (pct >= threshold)     return 'moderate'
  if (pct >= threshold / 2) return 'mild'
  return null
}

/**
 * GLIM 营养不良诊断
 * 至少 1 项表型标准 + 至少 1 项病因标准
 */
export function glimDiagnosis({ bmi, age, weightLoss, weightLossDuration, intakePct, hasInflammation }) {
  const phenotype = []
  // 表型 1: 体重下降
  if (weightLoss != null && weightLoss > 0 && weightLossDuration) {
    const d = weightLossDuration
    if (d <= 6 && weightLoss > 10) phenotype.push({ key: 'weight_loss', severity: 'severe', value: weightLoss })
    else if (d > 6 && weightLoss > 20) phenotype.push({ key: 'weight_loss', severity: 'severe', value: weightLoss })
    else if (d <= 6 && weightLoss >= 5) phenotype.push({ key: 'weight_loss', severity: 'moderate', value: weightLoss })
    else if (d > 6 && weightLoss >= 10) phenotype.push({ key: 'weight_loss', severity: 'moderate', value: weightLoss })
  }
  // 表型 2: 低 BMI
  if (bmi != null) {
    if (age >= 70) {
      if (bmi < 20)      phenotype.push({ key: 'low_bmi', severity: 'severe',   value: bmi })
      else if (bmi < 22) phenotype.push({ key: 'low_bmi', severity: 'moderate', value: bmi })
    } else {
      if (bmi < 18.5)    phenotype.push({ key: 'low_bmi', severity: 'severe',   value: bmi })
      else if (bmi < 20) phenotype.push({ key: 'low_bmi', severity: 'moderate', value: bmi })
    }
  }

  const etiology = []
  if (intakePct != null && intakePct <= 50) {
    etiology.push({ key: 'reduced_intake', value: intakePct })
  }
  if (hasInflammation) {
    etiology.push({ key: 'inflammation' })
  }

  const hasMalnutrition = phenotype.length > 0 && etiology.length > 0
  const severity = phenotype.some((p) => p.severity === 'severe') ? 'severe' :
                   phenotype.length > 0 ? 'moderate' : null

  return { hasMalnutrition, severity, phenotype, etiology }
}

/**
 * 应激程度评估：基于诊断、化验、NRS 等
 */
export function inferStressLevel({ diagnoses = [], crp, nrs2002 }) {
  const text = diagnoses.join(' ')
  const severeMarkers = /(脓毒|sepsis|多器官|MODS|烧伤|major burn|严重|critical|休克|shock)/i
  const moderateMarkers = /(术后|surgery|肿瘤|cancer|tumor|创伤|trauma|感染|infection|肺炎|pneumonia)/i

  if (severeMarkers.test(text) || (crp != null && crp > 50) || (nrs2002 != null && nrs2002 >= 5)) return 'severe'
  if (moderateMarkers.test(text) || (crp != null && crp > 10) || (nrs2002 != null && nrs2002 >= 3)) return 'moderate'
  return 'mild'
}

/**
 * 每日能量需求（kcal/d）
 */
export function energyTarget(weight_kg, stress) {
  if (!weight_kg) return null
  const ranges = {
    mild:     [25, 30],
    moderate: [28, 32],
    severe:   [30, 35]
  }
  const [lo, hi] = ranges[stress] || ranges.mild
  return { low: Math.round(weight_kg * lo), high: Math.round(weight_kg * hi), per_kg: [lo, hi] }
}

/**
 * 每日蛋白质需求（g/d）
 */
export function proteinTarget(weight_kg, stress, diagnoses = []) {
  if (!weight_kg) return null
  let ranges = {
    mild:     [1.0, 1.2],
    moderate: [1.2, 1.5],
    severe:   [1.5, 2.0]
  }
  const text = diagnoses.join(' ')
  // 肾病低蛋白调整（非透析期）
  if (/(慢性肾|CKD|肾衰)/i.test(text) && !/(透析|dialysis)/i.test(text)) {
    ranges = { mild: [0.6, 0.8], moderate: [0.6, 0.8], severe: [0.8, 1.0] }
  }
  const [lo, hi] = ranges[stress] || ranges.mild
  return { low: +(weight_kg * lo).toFixed(0), high: +(weight_kg * hi).toFixed(0), per_kg: [lo, hi] }
}

/**
 * 化验解读
 */
const LAB_RULES = [
  { name: '白蛋白',       en: 'Albumin',         lo: 35, severeLo: 30, unit: 'g/L',
    interp_zh_low:    '提示营养风险（需结合 CRP）',
    interp_zh_severe: '明显下降，需结合炎症水平评估',
    interp_en_low:    'Nutrition risk (consider CRP)',
    interp_en_severe: 'Severely low — interpret with inflammation status'
  },
  { name: '前白蛋白',     en: 'Prealbumin',      lo: 200, unit: 'mg/L',
    interp_zh_low: '近期摄入不足风险',
    interp_en_low: 'Recent intake deficiency risk'
  },
  { name: 'C反应蛋白',    en: 'C-Reactive Protein', hi: 10, severeHi: 50, unit: 'mg/L',
    interp_zh_high:   '存在炎症反应',
    interp_zh_severe: '炎症活跃，白蛋白解读需谨慎',
    interp_en_high:   'Active inflammation present',
    interp_en_severe: 'Severe inflammation — interpret albumin cautiously'
  },
  { name: '淋巴细胞计数', en: 'Lymphocytes',     lo: 1.5, unit: '×10^9/L',
    interp_zh_low: '免疫功能受损风险',
    interp_en_low: 'Possible immune compromise'
  },
  { name: '血红蛋白',     en: 'Hemoglobin',      lo: null, unit: 'g/L',
    custom: ({ value, gender }) => {
      const cutoff = gender === '女' || gender === 'female' ? 110 : 120
      if (value < cutoff) return { tag_zh: '贫血', tag_en: 'Anemia' }
      return null
    }
  },
  { name: '血糖',         en: 'Glucose',         lo: 3.9, hi: 6.1, unit: 'mmol/L',
    interp_zh_low:  '低血糖',
    interp_zh_high: '血糖偏高',
    interp_en_low:  'Low glucose',
    interp_en_high: 'Elevated glucose'
  }
]

export function interpretLabs(labResults = [], { gender } = {}) {
  const out = []
  for (const lab of labResults) {
    const rule = LAB_RULES.find((r) => r.name === lab.name || r.en === lab.name)
    if (!rule || lab.value == null || lab.value === '') continue
    const v = +lab.value
    if (Number.isNaN(v)) continue
    let status = 'normal'
    let zh = null, en = null
    if (rule.custom) {
      const r = rule.custom({ value: v, gender })
      if (r) { status = 'attention'; zh = r.tag_zh; en = r.tag_en }
    } else {
      if (rule.severeLo != null && v < rule.severeLo) {
        status = 'severe'; zh = rule.interp_zh_severe; en = rule.interp_en_severe
      } else if (rule.severeHi != null && v > rule.severeHi) {
        status = 'severe'; zh = rule.interp_zh_severe; en = rule.interp_en_severe
      } else if (rule.lo != null && v < rule.lo) {
        status = 'low'; zh = rule.interp_zh_low; en = rule.interp_en_low
      } else if (rule.hi != null && v > rule.hi) {
        status = 'high'; zh = rule.interp_zh_high; en = rule.interp_en_high
      }
    }
    if (status !== 'normal') {
      out.push({
        name_zh: rule.name, name_en: rule.en,
        value: v, unit: rule.unit, status, comment_zh: zh, comment_en: en
      })
    }
  }
  return out
}

export function nrs2002Interpret(score) {
  if (score == null || score === '') return null
  const s = +score
  if (Number.isNaN(s)) return null
  return {
    score: s,
    risk: s >= 3,
    severity: s >= 5 ? 'severe' : s >= 3 ? 'moderate' : 'low'
  }
}

/**
 * 主入口：根据 patient JSON 生成完整评估
 */
export function runAssessment(p) {
  const pi = p.patient_info || {}
  const age = pi.age
  const bmi = calcBMI(pi.height_cm, pi.weight_kg)
  const bmiCat = bmiCategory(bmi, age)
  const wl = weightLossPct(pi.usual_weight_kg, pi.weight_kg)
  const wlSev = weightLossSeverity(wl, pi.weight_loss_duration_months)

  const diagnoses = p.diagnoses || []
  const biochem = p.lab_results?.biochemistry || []
  const cbc = p.lab_results?.complete_blood_count || []
  const allLabs = [...biochem, ...cbc]
  const crp = biochem.find((b) => b.name === 'C反应蛋白' || b.name === 'C-Reactive Protein')?.value
  const intakePct = p.dietary_info?.intake_percentage

  const stress = inferStressLevel({ diagnoses, crp, nrs2002: p.NRS2002_score })
  const hasInflammation = (crp != null && +crp > 10) ||
                          /(术后|肿瘤|cancer|感染|infection|创伤|trauma|脓毒|sepsis)/i.test(diagnoses.join(' '))
  const glim = glimDiagnosis({
    bmi, age, weightLoss: wl, weightLossDuration: pi.weight_loss_duration_months,
    intakePct, hasInflammation
  })

  const energy = energyTarget(pi.weight_kg, stress)
  const protein = proteinTarget(pi.weight_kg, stress, diagnoses)
  const labFlags = interpretLabs(allLabs, { gender: pi.gender })
  const nrs = nrs2002Interpret(p.NRS2002_score)

  // PES 诊断（problem-etiology-signs）
  const pes = buildPES({ glim, intakePct, weightLoss: wl, bmi, age, diagnoses, labFlags })

  // 干预建议
  const actions = buildActions({ glim, nrs, stress, energy, protein, diagnoses, intakePct, labFlags })

  return {
    bmi, bmiCategory: bmiCat,
    weightLoss: wl, weightLossSeverity: wlSev,
    stressLevel: stress,
    energyTarget: energy,
    proteinTarget: protein,
    glim, nrs2002: nrs, labFlags, pes, actions,
    rawInput: p
  }
}

function buildPES({ glim, intakePct, weightLoss, bmi, age, labFlags }) {
  const items = []
  if (glim.hasMalnutrition) {
    items.push({
      key: 'malnutrition',
      problem_zh: glim.severity === 'severe' ? '重度蛋白质-能量营养不良' : '中度蛋白质-能量营养不良',
      problem_en: glim.severity === 'severe' ? 'Severe protein-energy malnutrition' : 'Moderate protein-energy malnutrition',
      etiology_zh: intakePct != null && intakePct <= 50 ? `摄入量降至需求 ${intakePct}%` : '疾病相关炎症与代谢负担',
      etiology_en: intakePct != null && intakePct <= 50 ? `Intake reduced to ${intakePct}% of needs` : 'Disease-related inflammation & metabolic burden',
      signs_zh:    [bmi != null ? `BMI ${bmi}` : null, weightLoss > 0 ? `体重下降 ${weightLoss}%` : null].filter(Boolean).join(' · '),
      signs_en:    [bmi != null ? `BMI ${bmi}` : null, weightLoss > 0 ? `Weight loss ${weightLoss}%` : null].filter(Boolean).join(' · ')
    })
  }
  if (intakePct != null && intakePct < 75) {
    items.push({
      key: 'inadequate_intake',
      problem_zh: '经口摄入不足',
      problem_en: 'Inadequate oral intake',
      etiology_zh: '食欲下降 / 吞咽困难 / 治疗副作用',
      etiology_en: 'Reduced appetite / dysphagia / treatment side-effects',
      signs_zh: `摄入约为需求的 ${intakePct}%`,
      signs_en: `Intake ≈ ${intakePct}% of needs`
    })
  }
  const lowAlb = labFlags.find((l) => l.name_en === 'Albumin')
  if (lowAlb) {
    items.push({
      key: 'low_albumin',
      problem_zh: '内脏蛋白水平偏低',
      problem_en: 'Reduced visceral protein status',
      etiology_zh: '炎症与摄入不足共同作用',
      etiology_en: 'Combined inflammation and inadequate intake',
      signs_zh: `白蛋白 ${lowAlb.value} g/L`,
      signs_en: `Albumin ${lowAlb.value} g/L`
    })
  }
  return items
}

function buildActions({ glim, nrs, stress, energy, protein, diagnoses, intakePct, labFlags }) {
  const a = []

  if (energy) {
    a.push({
      zh: `能量目标 ${energy.low}–${energy.high} kcal/d（按 ${energy.per_kg[0]}–${energy.per_kg[1]} kcal/kg/d）`,
      en: `Energy target ${energy.low}–${energy.high} kcal/d (${energy.per_kg[0]}–${energy.per_kg[1]} kcal/kg/d)`
    })
  }
  if (protein) {
    a.push({
      zh: `蛋白质目标 ${protein.low}–${protein.high} g/d（按 ${protein.per_kg[0]}–${protein.per_kg[1]} g/kg/d）`,
      en: `Protein target ${protein.low}–${protein.high} g/d (${protein.per_kg[0]}–${protein.per_kg[1]} g/kg/d)`
    })
  }

  if (glim.hasMalnutrition) {
    a.push({
      zh: '建议启动**口服营养补充 ONS**，必要时升级至肠内或肠外营养',
      en: 'Initiate **Oral Nutrition Supplementation (ONS)**; escalate to EN/PN as needed'
    })
  }
  if (nrs?.risk) {
    a.push({
      zh: 'NRS2002 ≥ 3 分，48 小时内由营养师启动营养干预',
      en: 'NRS2002 ≥ 3 — initiate nutrition intervention within 48 h'
    })
  }
  if (intakePct != null && intakePct < 50) {
    a.push({
      zh: '摄入 < 50%：考虑特医食品 ONS（如全营养配方），分次少量给予',
      en: 'Intake < 50%: consider FSMP (e.g., complete formula) in small frequent doses'
    })
  }
  const diagText = diagnoses.join(' ')
  if (/(糖尿病|diabetes)/i.test(diagText)) {
    a.push({ zh: '配方建议选择低 GI / 缓释碳水类（糖尿病专用配方）', en: 'Prefer low-GI / slow-release carb formulas (diabetes-specific FSMP)' })
  }
  if (/(肾|CKD|renal)/i.test(diagText)) {
    a.push({ zh: '关注电解质（钠 / 钾 / 磷）与液体平衡；选用肾病配方', en: 'Monitor Na/K/P and fluid balance; consider renal-specific formula' })
  }
  if (/(肝|hepatic|cirrhosis)/i.test(diagText)) {
    a.push({ zh: '考虑富含支链氨基酸 (BCAA) 配方', en: 'Consider BCAA-enriched formula' })
  }
  if (/(术后|肿瘤|cancer|surgery)/i.test(diagText)) {
    a.push({ zh: '补充 EPA/DHA、谷氨酰胺、精氨酸有助免疫与组织修复', en: 'EPA/DHA, glutamine, arginine may aid immunity and tissue repair' })
  }
  if (labFlags.some((l) => l.name_en === 'Hemoglobin')) {
    a.push({ zh: '贫血：检查铁/B12/叶酸并对因纠正', en: 'Anemia: workup iron/B12/folate and treat etiology' })
  }
  if (stress === 'severe') {
    a.push({ zh: '重度应激期注意**警惕再喂养综合征**，从 50% 目标量起步逐步递增', en: 'Severe stress: watch for refeeding syndrome — start at 50% target and titrate up' })
  }

  a.push({
    zh: '每周复评：体重、摄入量、白蛋白/前白蛋白、CRP；3–5 天调整方案',
    en: 'Reassess weekly: weight, intake, albumin/prealbumin, CRP; adjust every 3–5 days'
  })

  return a
}
