# Gratify One — Underwriting Product Spec
**Version:** 1.0  
**Date:** May 2026  
**Owner:** Ryan (CEO, Gratify)  
**Level:** Product (extends Platform Rules Engine)

---

## What This Is

The Underwriting product is the rule-setting and decision-making layer of Gratify One. It is where the ISO admin configures their org's full risk appetite — trust levels, scoring weights, override policies, MCC risk tiers, and letter grade thresholds. It is also where the underwriter sees the scored evidence pack for each merchant and makes their approve/decline/review decision.

Underwriting is NOT a separate system from the rules engine. It extends the platform rules engine with:
- Trust level multipliers (ISO-configurable per data source type)
- The three-factor scoring formula (Weight × Override Multiplier × Trust Multiplier × 10)
- Letter tier mapping (A/B/C/D with configurable thresholds)
- Pre-screen resolution config (`include_in_prescreen` toggle)
- External data source verification integrations
- The underwriter-facing evidence pack UI

**Relationship to SmartMPA:** SmartMPA inherits Underwriting rules at lower resolution. It evaluates only fields where `include_in_prescreen = true`, uses the same scoring formula, and returns a coarser result (thumbs up/down/review). SmartMPA has no independent rule configuration.

---

## What's Already Built (in Rules Engine Spec)

The platform-rules-engine.md spec covers:
- `risk_templates` with `fail_above` / `review_above` thresholds
- `entity_rules` with `risk_weight`, `override_policy`, `is_required`
- `range_rules` for range-based scoring
- `mcc_groups` and `mcc_rules` for MCC allow/block
- `template_assignments` for source/channel routing
- `evaluate` API that scores merchant data against rules
- Admin UI for template management, MCC config, entity rules, range editor

This spec adds what's needed to turn that foundation into the full Underwriting product.

---

## Schema Additions

### Additions to `entity_rules`

```sql
ALTER TABLE entity_rules ADD COLUMN
  include_in_prescreen BOOLEAN NOT NULL DEFAULT true,  -- SmartMPA evaluates this field?
  trust_level TEXT NOT NULL DEFAULT 'verify'
    CHECK (trust_level IN (
      'trust_merchant', 'verify', 'auto_detect', 'auto_fill',
      'calculated', 'manual', 'ocr_extract', 'ocr_with_auto_detect'
    )),
  data_source TEXT;                                     -- e.g. "OpenCorporates", "TinCheck", "Document"
```

**Default for `include_in_prescreen`:** Matches `is_required`. Required fields default to true (included in SmartMPA), optional/conditional fields default to false.

---

### New table: `trust_multipliers`

ISO-configurable trust multipliers per data source type. These are NOT platform constants — each ISO sets their own.

```sql
CREATE TABLE trust_multipliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES risk_templates(id) ON DELETE CASCADE,
  trust_level     TEXT NOT NULL CHECK (trust_level IN (
    'trust_merchant', 'verify', 'auto_detect', 'auto_fill',
    'calculated', 'manual', 'ocr_extract', 'ocr_with_auto_detect'
  )),
  multiplier      NUMERIC(3,2) NOT NULL,               -- e.g. 0.8, 1.0, 1.2
  description     TEXT NOT NULL,                       -- Human-readable explanation
  
  UNIQUE(template_id, trust_level)
);
```

**Seed defaults (from Ryan's scoring framework):**

| trust_level | default_multiplier | description |
|---|---|---|
| `trust_merchant` | 1.00 | Value provided directly by merchant, no verification |
| `verify` | 0.80 | Compared to trusted 3rd-party data source |
| `auto_detect` | 0.90 | System determines value from signals/multiple sources |
| `auto_fill` | 0.90 | Filled from trusted external record (e.g. registry) |
| `calculated` | 1.10 | Computed from other verified values or formulas |
| `manual` | 1.10 | Manually entered by underwriter |
| `ocr_extract` | 1.00 | Extracted from merchant-uploaded document |
| `ocr_with_auto_detect` | 1.00 | Document analysis to generate classification |

**Why ISO-configurable:** Different ISOs have different confidence levels in each data source. An ISO that has experienced poor OCR quality can increase that multiplier to penalize OCR-sourced fields. An ISO confident in merchant self-reporting can decrease `trust_merchant`. The platform provides the tools; the ISO determines the result.

---

### Additions to `risk_templates`

```sql
ALTER TABLE risk_templates ADD COLUMN
  tier_a_min      SMALLINT NOT NULL DEFAULT 91,        -- Score >= this = Tier A
  tier_b_min      SMALLINT NOT NULL DEFAULT 75,        -- Score >= this = Tier B
  tier_c_min      SMALLINT NOT NULL DEFAULT 25,        -- Score >= this = Tier C
  -- Below tier_c_min = Tier D
  show_letter_tier BOOLEAN NOT NULL DEFAULT true,      -- Display letter grades in UI
  show_numerical_score BOOLEAN NOT NULL DEFAULT true;  -- Display numerical score in UI
```

**Letter tier examples (from Ryan's spreadsheet):**

| ISO Type | A | B | C | D |
|---|---|---|---|---|
| Regular ISO | 91-100 | 75-90 | 25-74 | 0-24 |
| High-Risk ISO | 31-100 | 21-30 | 11-20 | 0-10 |

---

### New table: `override_multipliers`

ISO-configurable override multipliers per policy type.

```sql
CREATE TABLE override_multipliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES risk_templates(id) ON DELETE CASCADE,
  override_policy TEXT NOT NULL CHECK (override_policy IN (
    'allowed', 'with_approval', 'not_allowed'
  )),
  multiplier      NUMERIC(3,2) NOT NULL,               -- e.g. 0.8, 1.0, 1.2
  
  UNIQUE(template_id, override_policy)
);
```

**Seed defaults:**

| override_policy | default_multiplier | rationale |
|---|---|---|
| `allowed` | 0.80 | Field can be overridden → less trusted → lower contribution |
| `with_approval` | 1.00 | Neutral — requires human sign-off |
| `not_allowed` | 1.20 | Field is locked → highly trusted → contributes more |

---

## Scoring Formula

### Per-Field Score

```
field_score = risk_weight × override_multiplier × trust_multiplier × 10
```

Where:
- `risk_weight` = 0-10 (from `entity_rules.risk_weight`)
- `override_multiplier` = from `override_multipliers` table based on field's `override_policy`
- `trust_multiplier` = from `trust_multipliers` table based on field's `trust_level`

**Maximum possible per-field score** with weight=10, override=1.2, trust=1.2: 10 × 1.2 × 1.2 × 10 = **144 points**
**Typical per-field score** with weight=3, override=1.0, trust=0.8: 3 × 1.0 × 0.8 × 10 = **24 points**

### Field Result Score

Each field also gets a **result score** based on what was found:

| Result Type | How it works |
|---|---|
| Binary (Match/No Match) | Match = full field_score, No Match = 0 |
| Range-based | Lookup in `range_rules` → risk_weight from matching range replaces base risk_weight |
| Categorical | Lookup value maps to a score (e.g. Sole Prop = 6, Partnership = 4, Corp/LLC = 2) |
| Missing required | Contributes 0 (worst case — field_score counts against total) |
| Missing optional | Excluded from scoring entirely |

### Total Score Calculation

```
actual_score = SUM(field_result_scores for all evaluated fields)
max_possible_score = SUM(field_scores for all evaluated fields at best-case result)
normalized_score = (actual_score / max_possible_score) × 100
```

The normalized score (0-100) is what maps to:
- Letter tiers (A/B/C/D based on template thresholds)
- Numerical thresholds (`fail_above`, `review_above`)

### Decision Logic

The system uses two complementary scores:

- **Risk score** (0-100): Higher = riskier. A merchant with verified data and low-risk MCC scores low. A merchant with missing fields and high-risk indicators scores high.
- **Quality score** (0-100): Inverse of risk (`100 - risk_score`). Higher = better. Used for letter tier assignment.

```
risk_score = (actual_score / max_possible_score) × 100

if risk_score >= fail_above → decision: 'fail' (auto-decline)
if risk_score >= review_above → decision: 'review' (manual review)
if risk_score < review_above → decision: 'pass' (auto-approve)
```

**Letter tier assignment** uses quality score against ISO-configured thresholds:

```
quality_score = 100 - risk_score

if quality_score >= tier_a_min → Tier A (lowest risk)
else if quality_score >= tier_b_min → Tier B
else if quality_score >= tier_c_min → Tier C
else → Tier D (highest risk)
```

---

## Updated Evaluate API Response

The `evaluate` endpoint response gains Underwriting-specific fields:

```typescript
interface EvaluateResponse {
  decision: 'pass' | 'fail' | 'review';
  risk_score: number;                      // 0-100 normalized risk score
  quality_score: number;                   // 100 - risk_score
  max_possible_score: number;              // Sum of all field max scores
  letter_tier: 'A' | 'B' | 'C' | 'D';    // Based on quality_score vs template thresholds
  
  mcc_check: {
    is_allowed: boolean;
    risk_rating: string | null;
  };
  
  field_results: {
    field_key: string;
    display_name: string;
    category: string;                      // entity, financial, directors, etc.
    status: 'pass' | 'fail' | 'missing' | 'review';
    risk_weight: number;
    trust_level: string;
    override_policy: string;
    override_multiplier: number;
    trust_multiplier: number;
    field_max_score: number;               // Theoretical max for this field
    field_actual_score: number;            // What this merchant scored
    risk_contribution: number;             // Percentage of total risk this field contributes
    value_provided: any | null;
    value_verified: any | null;            // What the data source returned (if verification ran)
    data_source: string | null;
    verification_status: 'verified' | 'mismatch' | 'not_checked' | 'source_unavailable';
    message?: string;
  }[];
  
  flags: string[];                         // e.g. ["missing_required_field:ein", "high_risk_mcc", "match_hit"]
  
  // Only in full Underwriting mode (not SmartMPA)
  evidence_summary?: {
    total_fields_evaluated: number;
    fields_passed: number;
    fields_failed: number;
    fields_missing: number;
    top_risk_contributors: { field_key: string; contribution_pct: number }[];
    verification_sources_used: string[];
  };
}
```

**SmartMPA mode vs Underwriting mode:**
- SmartMPA: evaluates only fields where `include_in_prescreen = true`. Does not include `evidence_summary`. Returns simplified `field_results` (fewer fields).
- Underwriting: evaluates ALL fields. Includes full `evidence_summary`. Returns complete `field_results` with verification detail.

The API determines mode based on a query parameter: `?mode=prescreen` (SmartMPA) vs `?mode=full` (Underwriting, default).

---

## Data Source Integrations (Verification Services)

Each field with `trust_level: 'verify'` or `trust_level: 'auto_detect'` can call an external data source. The Underwriting product needs adapters for:

| Data Source | Fields Verified | Integration Type |
|---|---|---|
| OpenCorporates | legal_business_name, business_address, corporate_structure, business_registration_status, principal_name | REST API |
| TinCheck | ein | REST API |
| Plaid / Giact | bank_account_verified | REST API (bank verification) |
| Equifax | personal_credit_score | REST API (credit pull) |
| MA MATCH | termination_history | REST API (Mastercard MATCH list) |
| Ekata | email_domain, phone_number | REST API |
| edq.com | phone_number | REST API (phone verification) |
| Document OCR | years_in_business, bank_statements, P&L, voided_cheque | Internal (MSA parser engine) |
| GPT/AI | mcc_detection, dba_verification, chargeback_ratio | Internal (AI inference, always labelled) |

**Architecture:** Each data source gets a verification adapter with a standard interface:

```typescript
interface VerificationAdapter {
  source_name: string;
  verify(field_key: string, merchant_value: any, context: MerchantContext): Promise<VerificationResult>;
}

interface VerificationResult {
  status: 'verified' | 'mismatch' | 'source_unavailable';
  source_value: any;                       // What the external source returned
  confidence: number;                      // 0-1
  raw_response?: any;                      // For audit trail
}
```

**Important:** Not all fields need external verification for MVP. Many fields (volume, ticket size, years in business) use range-based scoring from the merchant's own data. External verification adapters are additive — the scoring engine works without them (fields just score at `trust_merchant` level if no adapter exists).

---

## Underwriter UI: Evidence Pack View

The underwriter sees a full evidence pack for each merchant application. This is the primary Underwriting product surface.

**Layout:**
1. **Header** — Merchant name, DBA, MCC, submission date. Large score display: numerical score + letter tier + decision badge (Pass/Fail/Review).

2. **Score breakdown** — Visual bar showing quality score vs thresholds. Shows where this merchant falls relative to auto-approve, review, and auto-decline zones.

3. **Category tabs** — Same as admin config: Entity, Financial, Directors, Business Model, Compliance. Each tab shows the fields in that category with:
   - Field name
   - Value provided (merchant's input)
   - Value verified (from data source, if applicable)
   - Status icon (✅ pass, ❌ fail, ⚠️ missing, 🔍 review)
   - Score contribution (how much this field contributed to total risk)
   - Data source badge ("OpenCorporates", "TinCheck", "Self-reported")

4. **Risk flags panel** — Sidebar showing top risk contributors, MATCH hits, MCC risk, missing required fields.

5. **Decision actions** — Approve / Decline / Request More Info / Escalate buttons. Decision is recorded with underwriter notes and timestamp.

6. **Evidence trail** — Collapsible section showing raw verification responses, timestamps, source reliability.

---

## Expanded Field Registry

The current `entity_rules` field_key CHECK constraint has 18 fields. Based on Ryan's scoring framework (62 data points), the registry expands significantly. Grouped by category:

### Company (11 fields)
- `mcc` — MCC code (from application or estimated)
- `mcc_risk_tier` — Risk level associated with MCC (L/M/H)
- `legal_business_name` — Legal entity name
- `dba_name` — Doing Business As name
- `ein` — EIN / Business Number
- `business_address` — Registered address
- `phone_number` — Business phone
- `years_in_business` — Operating duration
- `corporate_structure` — LLC, Corp, Sole Prop, etc.
- `business_registration_status` — Active/Good Standing
- `website_url` — Business website

### Financial (16 fields)
- `monthly_volume` — Monthly processing volume ($)
- `average_ticket` — Average transaction size ($)
- `high_ticket` — Highest expected transaction ($)
- `annual_revenue` — Annual revenue ($)
- `bank_account_verified` — Bank account ownership confirmed
- `bank_statements` — 3-6 months bank statements
- `profit_loss` — P&L statements
- `existing_liens` — Existing loans or liens
- `previous_processor` — Previous processor name
- `chargeback_ratio` — Chargeback rate (%)
- `refund_rate` — Refund rate (%)
- `termination_history` — MATCH list check
- `credit_exposure_average` — 3-month average credit risk
- `credit_exposure_maximum` — Peak credit risk
- `credit_exposure_mcc_ratio` — MCC-predicted risk ratio
- `reserve_required` — Calculated reserve requirement

### People (13 fields)
- `principal_name` — Principal/owner name(s)
- `principal_dob` — Date of birth
- `principal_age` — Age (must be 18+)
- `principal_ssn` — SSN/SIN
- `principal_address` — Home address
- `principal_govt_id` — Government ID upload
- `principal_phone` — Personal phone
- `principal_govt_id_number` — Government ID number
- `personal_credit_score` — FICO score
- `principal_email_domain` — Email domain verification
- `income_verification` — Income proof
- `employment_verification` — Employment status
- `personal_guarantee` — PG required (Yes/No)
- `principal_ownership_pct` — Ownership percentage

**Note:** The CHECK constraint on `entity_rules.field_key` must be expanded to include all fields above. This is a schema migration as part of the Underwriting build.

---

## What's NOT In This Spec

- **Sanctions screening (OFAC):** SmartMPA feature, not configurable per ISO
- **BBB complaints:** SmartMPA feature, not configurable per ISO
- **Ongoing risk monitoring:** Re-Pricing product concern
- **Reserve management post-boarding:** Future Underwriting enhancement
- **Automated credit pulls:** Phase 2 — requires ISO-level agreements with credit bureaus
- **Document OCR for bank statements/P&L:** Reuses MSA parser engine, not new build

---

## Implementation Priority

**Phase 1 — Scoring engine (extends rules engine):**
1. Schema migration: add columns to `entity_rules` and `risk_templates`, create `trust_multipliers` and `override_multipliers` tables, expand field registry
2. Scoring engine: implement three-factor formula with normalized scoring
3. Updated evaluate API: add `mode` param, letter tier in response, evidence summary
4. Admin UI: trust multiplier configuration
5. Admin UI: override multiplier configuration  
6. Admin UI: letter tier threshold configuration
7. Admin UI: pre-screen toggle per field

**Phase 2 — Underwriter experience:**
8. Underwriter dashboard: evidence pack view with score breakdown
9. Decision workflow: approve/decline/escalate with notes
10. Evidence trail: raw verification data display

**Phase 3 — Verification integrations (additive, one per ticket):**
11. OpenCorporates adapter (business verification)
12. TinCheck adapter (EIN verification)
13. Ekata adapter (phone/email verification)
14. MA MATCH adapter (termination history)
15. Plaid/Giact adapter (bank verification)
16. Equifax adapter (credit pull) — requires ISO-level agreement

---

## Red Team Notes

**Potential issues identified:**

1. **Score normalization with variable field counts.** If SmartMPA evaluates 15 fields and Underwriting evaluates 40, the normalized scores are not directly comparable. Solution: each mode's score is relative to its own evaluated field set only. SmartMPA and Underwriting scores represent different resolutions of the same risk picture and should not be compared numerically.

2. **Trust multiplier direction may appear counterintuitive.** Lower multiplier (e.g. Verify = 0.8) means less contribution to risk score. The multiplier represents how much a field contributes to the RISK calculation. Verified data (lower multiplier) contributes less risk because the system trusts it more — there is less uncertainty to penalize. Unverified self-reported data (higher multiplier) contributes more risk because greater uncertainty exists. This matches the scoring framework in Underwriting Rules v1.xlsx.

3. **Field registry expansion is a breaking change.** Going from 18 to 40+ fields in the CHECK constraint requires careful migration. The `seed_template()` function also needs updating to create entity_rules for all new fields. Solution: migration adds new fields to CHECK, updates seed function, backfills existing templates with new fields at default settings.

4. **Verification adapter failures.** If OpenCorporates is down, what happens to the score? Solution: `source_unavailable` status → field scores at `trust_merchant` level (conservative — assumes no verification). Flag in evidence pack: "Verification unavailable — scored at self-reported trust level."

5. **Max possible score changes per merchant.** If a field is "missing optional" it's excluded from both actual and max score. The denominator varies per merchant by design — optional data that is not provided does not penalize the merchant.

**Accepted for phase 1:**
- No automated credit pulls (requires bureau agreements)
- No document OCR verification (MSA parser integration is Phase 3)
- Verification adapters are Phase 3 — scoring engine works without them using self-reported trust level
