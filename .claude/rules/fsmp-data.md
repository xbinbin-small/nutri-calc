---
description: Schema and conventions for FSMP product entries in src/data/fsmp.json.
paths:
  - "src/data/fsmp.json"
---

# FSMP 数据条目规范

## 数据性质

`src/data/fsmp.json` 是**真实产品数据**，从厂家说明书 / 包装标签 / 医护资料卡录入。
**不是示例模板**（早期曾是，现在不是了）。每条都必须有可追溯的 `source` 字段。

新增条目前必须有可验证的来源（说明书 PDF、厂家官网、注册库等）。**没有来源不录入。**

## 必填字段

- `id` — 唯一 slug（kebab-case）
- `name_zh`, `name_en` — 产品名（中英）
- `brand_zh`, `brand_en` — 品牌
- `category` — `complete` / `specific` / `non-complete`
- `indications` — 字符串数组；每个 ID **必须**已存在于 `src/data/conditions.json`
- `form` — `powder` / `liquid` / `semi-solid`
- `package_zh`, `package_en` — 规格描述
- `serving_zh`, `serving_en` — 推荐用量描述
- `per_serving` — `{ amount, calories, protein, fat, carbs, ... }` 营养表
- `per_100g` — `{ calories, protein, fat, carbs, ... }` 营养表（单位见 `per_100_unit`）
- `per_100_unit` — `"g"` 或 `"mL"`
- `market` — 市场代码：`CN` / `US` / `UK`
- `regulatory_category` — 监管分类（枚举见下）
- `nutrition_basis` — 营养数据依据（枚举见下）
- `source` — 数据来源对象

## 选填字段

- `registration_no` — 注册号 / 批准号（中国大陆产品强烈建议填，如 "国药准字HJ20181147"）
- `features_zh`, `features_en` — 产品特点数组
- `contraindications_zh`, `contraindications_en` — 禁忌
- `notes_zh`, `notes_en` — 备注

## 枚举值

任何新增的枚举值都必须**同时**在两份 i18n locale 加上对应翻译，否则前端会显示原始代码（如 "cn_enteral_drug"）。

### `regulatory_category` → i18n key `fsmp_regulatory.<value>`

- `cn_enteral_drug` — 中国肠内营养药品（国药准字）
- `nutrition_supplement` — 营养补充剂
- `medical_nutrition_supplement` — 医学营养补充
- `pediatric_nutrition_supplement` — 儿科营养补充
- `eu_uk_fsmp` — 欧盟 / 英国 FSMP

### `market` → i18n key `fsmp_market.<value>`

- `CN` / `US` / `UK`

### `nutrition_basis` → i18n key `fsmp_basis.<value>`

- `manufacturer_instructions` — 厂家说明书
- `manufacturer_label` — 包装标签
- `manufacturer_hcp_data_card` — 医护资料卡

### `source` 对象结构

```json
{
  "name": "厂家说明书标题",
  "url": "https://...pdf",
  "accessed_at": "YYYY-MM-DD",
  "label_revision": "YYYY-MM-DD"
}
```

`url` 应指向官方公开文档（厂家网站、CFDA 注册库等）。无 url 也可（设为 null 或省略），但要写清 `name`。`label_revision` 是标签自身的版本日期，`accessed_at` 是我们查阅的日期。

## 跨文件不变式（提交前自检）

每个 `indications[i]` 必须存在于 `conditions.json` 的 `id` 列表。检查命令：

```sh
node -e "const c = require('./src/data/conditions.json').map(x=>x.id); const f = require('./src/data/fsmp.json'); const m = []; f.forEach(p=>p.indications.forEach(i=>{if(!c.includes(i)) m.push({id:p.id, i})})); console.log(m.length ? '⚠️ 缺失:' : '✓ all indications resolve', m)"
```

## 临床安全约束

虽然条目里有真实品牌名，**AI 输出端「不推荐具体品牌」的约束依然适用**（见 `clinical-content.md`）。

- UI 可以展示品牌（用户主动浏览 FSMP 库 → 看产品标签是合理需求）
- AI 系统提示词 (`functions/_lib/skill-prompt.js`) 中**禁止**推荐具体品牌，只能到"类别"层（如「糖尿病专用全营养配方」）

这两件事不矛盾——展示 ≠ 推荐。
