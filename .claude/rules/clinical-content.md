---
description: Clinical and medical safety constraints for nutrition advice content. Always loaded.
---

# 临床内容安全约束

This is a clinical nutrition tool. Treat all content related to medical advice with extra care, regardless of which file you are editing.

## Hard rules for any medical text (UI copy, prompts, JSON data, README, etc.)

- **No brand or commercial product names** in FSMP recommendations. Category-level only (e.g., "diabetes-specific complete formula"). The AI system prompt at `functions/_lib/skill-prompt.js` enforces this — preserve it.
- **No medication suggestions** beyond what the attending physician has authorized.
- **No wellness / alternative-medicine** content. Evidence-based clinical nutrition only.
- Every recommendation needs a basis: a guideline name (GLIM 2018 / NRS2002 / ESPEN / etc.), a lab value, or a documented sign.
- For uncertain calls, explicit "to be confirmed by attending physician" / "需主管医师确认" wording is required.
- All AI-generated reports must keep the existing disclaimer text in the UI (`assessment.ai.disclaimer` locale key).

## Clinical reference baselines

When generating or editing clinical logic / prompts, these baselines apply:

- **GLIM 2018**: ≥1 phenotypic (weight loss / low BMI / sarcopenia) + ≥1 etiologic (reduced intake / inflammation)
- **NRS2002 (Kondrup 2003)**: ≥3 = at risk, intervene within 48 h
- **ESPEN**: energy 25–35 kcal/kg/d, protein 1.0–2.0 g/kg/d (by stress level)
- **CKD non-dialysis**: protein 0.6–0.8 g/kg/d (low-protein — **never** suggest high-protein); on dialysis ≥1.2 g/kg/d
- **Cirrhosis**: BCAA-enriched, protein 1.2–1.5 g/kg/d
- **Severe stress / chronic low intake**: must warn refeeding syndrome, start at 50% target

The deterministic implementation lives in `src/composables/useAssessment.js`. AI is only allowed to interpret these numbers, never to modify them — this contract is also encoded in `skill-prompt.js`.

## Data authenticity

`src/data/fsmp.json` was historically a "template samples" file but **has since been replaced with real product data** sourced from manufacturer labels, instructions and HCP data cards (Abbott, Nutricia, etc.). Each entry now carries `source`, `registration_no`, `regulatory_category`, `nutrition_basis`, `market`. Schema in `fsmp-data.md`.

Implications:

- **Do not "fix" the locale strings or UI copy back to "sample / template"** — they were intentionally rewritten (see `fsmp.sample_notice`, `fsmp.subtitle`). The current copy ("based on public labels or manufacturer instructions, verify before clinical use") is the correct framing.
- When the user asks to add a new FSMP product, **require a verifiable source** (label PDF, manufacturer site, registration record). No source = no entry.
- `foods.json` still contains common reference values, not real product labels. Differentiate the two.

## Brand names: data vs AI output

Real brand names (雅培 / Abbott, 纽迪希亚 / Nutricia, ...) now appear in `fsmp.json` data and the FSMP library UI — this is fine, the user is browsing a catalog.

**But the AI output rules in `functions/_lib/skill-prompt.js` still forbid brand-level recommendations** ("category only, no brand names"). UI display ≠ AI recommendation. Don't relax the prompt constraint just because the data has brands.

## 科普文章 / Articles (`src/articles/`)

The `/articles` corpus (~23 bilingual pieces) is clinical-nutrition education and must follow the same safety bar:

- **Evidence-based only**, no wellness / alt-medicine. Every article cites a **verifiable public source** in `## 参考资料` — a guideline name, national NHC / CDC, WHO, etc. **Never** keep private exam-note citations (e.g. `本站笔记: 营养学/xxx.md`); strip them when adapting drafts.
- Keep **"consult physician / registered dietitian"** caveats for special populations (pregnancy, infants, CKD, diabetes, etc.).
- Treatment / medication may be described only in an **educational "what the doctor may do"** framing (e.g. "由医生根据病情决定…补液纠正电解质紊乱") — **never** as self-medication instructions. Reinforce "及时就医 / 不要自行用药".
- No brand-name product recommendations (category-level only), same as elsewhere.
- Workflow + house writing style live in root `CLAUDE.md` → Articles workflow.

## Patient privacy

The assessment form holds identifiable clinical data (name, diagnoses, labs, weight). It is:
- Persisted in browser `localStorage['nutri.assessment.v1']`
- Sent to a third-party LLM (DeepSeek / MiniMax / GLM) inside the `patient` field of the AI request

Rules:
- **Do not log `patient` content server-side** in the Cloudflare Function.
- **Do not persist patient data to KV / R2 / D1** (only KV usage allowed is `rl:<date>:<ip>` rate-limit counters).
- **Do not propose features that retain identifiable data on the server** unless the user explicitly authorizes and a privacy notice is added.

## Charging-related caution

The user has explored charging users for AI assessments. Charging for medical content has regulatory implications — if the user asks to add payment, flag that the "for educational use only" disclaimer becomes harder to defend and suggest reviewing local regulations before implementing.
