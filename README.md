# NutriCalc · 营养素计算器 / Nutrition Calculator

> 一个**纯静态**、**中英双语**、内置「特医食品 (FSMP) 模块」的营养素计算器。  
> Pure-static · bilingual · with a dedicated **FSMP** (Food for Special Medical Purposes) module.

---

## ✨ 核心特色 / Highlights

| | 中文 | English |
|---|---|---|
| 营养计算 | 多食物 / 多份特医食品自由组合，自动汇总能量与三大营养素 | Mix regular foods and medical foods, instant nutrient roll-up |
| 每日需求 | Mifflin-St Jeor 公式 BMR / TDEE + DRI 微量营养素推荐 | BMR/TDEE via Mifflin-St Jeor + DRI micronutrient targets |
| **特医食品库 ★** | 按疾病浏览（糖尿病/肾病/肿瘤/肝病/围手术期/儿科/PKU 等），可加入计算器 | Browse FSMP by condition (Diabetes / Renal / Oncology / Hepatic / Peri-op / Pediatric / PKU …) |
| 双语 | 一键切换中英文，本地持久化 | One-click EN / ZH toggle, persisted |
| 部署 | 一键 Vercel / Netlify / Cloudflare / GitHub Pages | One-click deploy anywhere static |

> 与同类工具的关键差异：**专门的 FSMP 模块 + 可扩展的 JSON 数据层**——你只需补充自有产品数据，就能拥有别人没有的特医食品计算器。  
> Differentiator: a dedicated FSMP module backed by JSON files — drop in your own product data to build something unique.

---

## 🚀 本地开发 / Local development

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # 输出到 dist/
npm run preview  # 本地预览 build 产物
```

要求 Node 18+。

---

## 📁 数据扩展 / Extend the data

所有数据都是普通 JSON，**直接编辑即可**：

```
src/data/foods.json        普通食物
src/data/fsmp.json         特医食品（你后续补充的核心数据）
src/data/conditions.json   疾病分类
src/data/dri.json          营养素推荐摄入量 (RDA / AMDR)
src/locales/zh-CN.json     中文文案
src/locales/en-US.json     英文文案
```

### `fsmp.json` Schema

```jsonc
{
  "id": "unique-id",                          // 唯一 ID
  "name_zh": "中文产品名",
  "name_en": "English product name",
  "brand_zh": "品牌",
  "brand_en": "Brand",
  "category": "complete | specific | non-complete",
  "indications": ["diabetes", "renal", "..."],
  "form": "powder | liquid | semi-solid",
  "package_zh": "400 g / 罐",
  "package_en": "400 g / can",
  "serving_zh": "55 g 冲调 200 mL",
  "serving_en": "55 g powder to 200 mL",
  "per_serving": { "amount": 55, "calories": 250, "protein": 9, "fat": 8.5, "carbs": 35,
                   "fiber": 1.8, "sodium": 100, "potassium": 320, "calcium": 200 },
  "per_100g":    { "calories": 455, "protein": 16.4, "...": "..." },
  "features_zh": ["..."], "features_en": ["..."],
  "contraindications_zh": "...", "contraindications_en": "...",
  "notes_zh": "...", "notes_en": "..."
}
```

`indications` 中的 ID 必须出现在 `conditions.json` 中，否则筛选器不会显示该疾病。

---

## 🌐 一键上线 / Deploy

### Vercel
1. 把仓库 push 到 GitHub
2. 在 [vercel.com](https://vercel.com) "Import Project" → 选择仓库 → 默认设置即可
3. `vercel.json` 已配置好 SPA rewrite

### Netlify
1. 把仓库 push 到 GitHub
2. 在 [netlify.com](https://netlify.com) "Add new site" → 选择仓库 → 默认设置
3. `netlify.toml` 已配置好

### Cloudflare Pages
- Build command: `npm run build`
- Build output: `dist`

### GitHub Pages
```bash
npm run build
# 路由已用 history 模式：需配置 SPA 回退（把 dist/404.html 设为 index.html 的副本），
# 否则深层路径刷新会 404。Cloudflare Pages / Netlify / Vercel 已通过 _redirects 等自动回退。
```

也可以直接把 `dist/` 上传到任何静态托管（需支持 SPA 回退到 `index.html`）。

---

## 🛠 技术栈 / Tech stack

- **Vue 3** (Composition API + `<script setup>`)
- **Vite 6** 构建
- **Vue Router 4** (history 模式，干净 URL，利于 SEO；需 SPA 回退)
- **Vue I18n 10** 双语支持
- 纯前端 + JSON 数据 = 零后端，零密钥，零运维

---

## ⚠️ 免责声明 / Disclaimer

本工具用于**营养教育与计算演示**，食物数据多为示例或常见参考值。特医食品 / 肠内营养 / 医学营养补充产品条目按公开标签、厂家说明书或官方 HCP 数据卡录入；产品配方和注册状态可能更新，临床使用前请核对当前包装和医嘱。本工具不构成医疗或营养建议，临床决策请咨询医生或注册营养师。

This tool is for nutritional education. FSMP / enteral nutrition / medical nutrition supplement entries are transcribed from public labels, manufacturer instructions, or official HCP data cards. Formulas and registration status may change; verify the current package and clinician order before clinical use. Not medical advice. Consult a physician or RD for clinical decisions.

---

## 📜 License

MIT
