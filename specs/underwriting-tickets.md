# Underwriting — Linear Tickets

All tickets use the Gratify Labs project (GRA-xx). Module labels: `module:shell` for platform/scoring infrastructure, `module:shared-ui` for admin and underwriter UI, `module:experiment-underwriting` for product-specific features.

---

## Phase 1: Scoring Engine

---

## Ticket 1 of 14

Title: [Shell] Schema migration — Add trust multipliers, override multipliers, letter tiers, and expanded field registry

Labels: module:shell, type:schema, priority:p0

### Context
The Underwriting product extends the platform rules engine with a richer scoring model. This migration adds the tables and columns needed for the three-factor scoring formula (Weight × Override Multiplier × Trust Multiplier × 10), letter tier display, and SmartMPA pre-screen field filtering. It also expands the entity_rules field registry from 18 to 40+ fields to cover the full underwriting data point set.

### What to build
Create a Supabase migration that:

1. **Alters `entity_rules`** — Add columns:
   - `include_in_prescreen` (BOOLEAN NOT NULL DEFAULT true) — whether SmartMPA evaluates this field
   - `trust_level` (TEXT NOT NULL DEFAULT 'verify', CHECK IN ('trust_merchant', 'verify', 'auto_detect', 'auto_fill', 'calculated', 'manual', 'ocr_extract', 'ocr_with_auto_detect'))
   - `data_source` (TEXT, nullable) — e.g. "OpenCorporates", "TinCheck"
   - Expand `field_key` CHECK constraint to include all 40 fields (see spec Section "Expanded Field Registry")

2. **Alters `risk_templates`** — Add columns:
   - `tier_a_min` (SMALLINT NOT NULL DEFAULT 91)
   - `tier_b_min` (SMALLINT NOT NULL DEFAULT 75)
   - `tier_c_min` (SMALLINT NOT NULL DEFAULT 25)
   - `show_letter_tier` (BOOLEAN NOT NULL DEFAULT true)
   - `show_numerical_score` (BOOLEAN NOT NULL DEFAULT true)

3. **Creates `trust_multipliers`** — Columns: `id` (UUID PK), `template_id` (UUID FK → risk_templates ON DELETE CASCADE), `trust_level` (TEXT NOT NULL, same CHECK as entity_rules.trust_level), `multiplier` (NUMERIC(3,2) NOT NULL), `description` (TEXT NOT NULL). UNIQUE on (template_id, trust_level). RLS: scoped through template_id → risk_templates → org_id, admin-only writes.

4. **Creates `override_multipliers`** — Columns: `id` (UUID PK), `template_id` (UUID FK → risk_templates ON DELETE CASCADE), `override_policy` (TEXT NOT NULL, CHECK IN ('allowed', 'with_approval', 'not_allowed')), `multiplier` (NUMERIC(3,2) NOT NULL). UNIQUE on (template_id, override_policy). RLS: same pattern.

5. **Updates `seed_template()` function** — When a new template is created, also seed:
   - `trust_multipliers` with defaults: trust_merchant=1.00, verify=0.80, auto_detect=0.90, auto_fill=0.90, calculated=1.10, manual=1.10, ocr_extract=1.00, ocr_with_auto_detect=1.00
   - `override_multipliers` with defaults: allowed=0.80, with_approval=1.00, not_allowed=1.20
   - `entity_rules` for ALL 40 field_keys (not just original 18), with `include_in_prescreen` defaulting to match `is_required`

6. **Backfill existing templates** — If any templates already exist from the rules engine build, add the new entity_rules rows and multiplier defaults for those templates.

### Acceptance criteria
- [ ] `entity_rules` has new columns with correct types and constraints
- [ ] `risk_templates` has letter tier columns with correct defaults
- [ ] `trust_multipliers` table created with RLS, seeded for existing templates
- [ ] `override_multipliers` table created with RLS, seeded for existing templates
- [ ] `field_key` CHECK constraint expanded to 40 fields (all categories: Company, Financial, People)
- [ ] `seed_template()` creates multiplier defaults and all 40 entity_rules rows
- [ ] Backfill runs cleanly for any pre-existing templates
- [ ] Migration does NOT break existing rules engine functionality (all existing queries still work)
- [ ] RLS on new tables follows same pattern as existing rules engine tables

### Data contract
Input: SQL migration file
Output: 2 new tables, altered entity_rules and risk_templates, updated seed function

### Do NOT
- Do not modify the evaluate API — that's the next ticket
- Do not build any UI — that's Phase 1 tickets 4-7
- Do not add verification adapter tables — those come in Phase 3
- Do not remove or rename existing columns — additive only

### Reference
- Spec: specs/underwriting-product.md, Schema Additions section
- Spec: specs/platform-rules-engine.md (existing schema)
- Design reference: Underwriting Rules v1.xlsx (Data Points sheet for full field list)
- Dependencies: Rules engine ticket 1 (GRA-XX, schema must exist first)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): underwriting schema migration (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 2 of 14

Title: [Shell] Implement three-factor scoring engine — Weight × Override × Trust × 10 with normalized output

Labels: module:shell, type:feature, priority:p0

### Context
The platform rules engine currently has a simple risk_weight-based scoring model. Underwriting requires the full three-factor formula that produces a normalized 0-100 score, maps to letter tiers, and handles variable field counts correctly. This is the core computation engine that both Underwriting and SmartMPA consume.

### What to build
Create a scoring engine module at `/lib/scoring/engine.ts` (or appropriate path) that implements:

**Core function:**
```typescript
interface ScoringInput {
  template_id: string;
  merchant_data: Record<string, any>;
  mode: 'prescreen' | 'full';     // prescreen = SmartMPA, full = Underwriting
}

interface ScoringOutput {
  risk_score: number;              // 0-100 normalized
  quality_score: number;           // 100 - risk_score
  letter_tier: 'A' | 'B' | 'C' | 'D';
  decision: 'pass' | 'fail' | 'review';
  max_possible_score: number;
  actual_score: number;
  field_results: FieldResult[];
}
```

**Per-field scoring logic:**
1. Look up the field's `risk_weight`, `override_policy`, and `trust_level` from `entity_rules`
2. Look up `override_multiplier` from `override_multipliers` (by template_id + override_policy)
3. Look up `trust_multiplier` from `trust_multipliers` (by template_id + trust_level)
4. Compute `field_max_score = risk_weight × override_multiplier × trust_multiplier × 10`
5. Compute `field_actual_score` based on result type:
   - Binary (Match/No Match): Match = field_max_score, No Match = 0
   - Range-based: look up matching range in `range_rules`, use range's risk_weight in place of base
   - Missing required: 0 (worst case)
   - Missing optional: EXCLUDED from scoring entirely (not counted in max or actual)
6. In `prescreen` mode, only evaluate fields where `include_in_prescreen = true`

**Normalization:**
```
normalized_risk_score = (sum_actual / sum_max_possible) × 100
quality_score = 100 - normalized_risk_score
```

**Decision logic:**
```
if normalized_risk_score >= template.fail_above → 'fail'
else if normalized_risk_score >= template.review_above → 'review'
else → 'pass'
```

**Letter tier logic:**
```
if quality_score >= template.tier_a_min → 'A'
else if quality_score >= template.tier_b_min → 'B'
else if quality_score >= template.tier_c_min → 'C'
else → 'D'
```

### Acceptance criteria
- [ ] Function accepts template_id, merchant_data, and mode
- [ ] Three-factor formula correctly computes per-field scores
- [ ] Override multiplier and trust multiplier pulled from their respective tables
- [ ] `prescreen` mode only evaluates fields where `include_in_prescreen = true`
- [ ] `full` mode evaluates ALL fields in the template
- [ ] Missing optional fields excluded from both numerator and denominator
- [ ] Missing required fields score 0 but count toward max (penalized)
- [ ] Normalized score produces 0-100 range
- [ ] Letter tier correctly maps quality_score to A/B/C/D using template thresholds
- [ ] Decision correctly maps risk_score to pass/fail/review using template thresholds
- [ ] Range-based fields correctly look up the matching range's risk_weight
- [ ] Unit tests: all fields pass (low score), all fields fail (high score), mixed, missing optional excluded, prescreen vs full mode difference

### Data contract
Input: `ScoringInput` (template_id, merchant_data record, mode)
Output: `ScoringOutput` (risk_score, quality_score, letter_tier, decision, field_results[])

### Do NOT
- Do not call external verification services — that's Phase 3. Scoring works with whatever data is provided.
- Do not persist results to database — the caller handles storage
- Do not build API routes — that's ticket 3
- Do not implement MCC checking — the existing check-mcc handles that separately

### Reference
- Spec: specs/underwriting-product.md, Scoring Formula section
- Design reference: Underwriting Rules v1.xlsx (Data Points "Adjusted Score" column)
- Dependencies: GRA-XX (ticket 1 of this set — schema must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): three-factor scoring engine (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 3 of 14

Title: [Shell] Update evaluate API — Add mode param, letter tier, evidence summary, three-factor scoring

Labels: module:shell, type:feature, priority:p0

### Context
The evaluate API (from rules engine ticket 5) currently uses a simple risk_weight scoring model. This ticket wires it to the new three-factor scoring engine and adds the Underwriting-specific response fields: letter tier, quality score, evidence summary, and the mode parameter that distinguishes SmartMPA (prescreen) from Underwriting (full) evaluation.

### What to build
Update `POST /api/rules/evaluate` to:

1. **Accept `mode` parameter** — `'prescreen'` (SmartMPA) or `'full'` (Underwriting, default). Pass this through to the scoring engine.

2. **Replace simple scoring with three-factor engine** — Call the scoring engine (ticket 2) instead of the simple risk_weight sum. The scoring engine handles all multiplier lookups and normalization internally.

3. **Expand response** to include:
   - `risk_score` (number, 0-100)
   - `quality_score` (number, 0-100)
   - `letter_tier` ('A' | 'B' | 'C' | 'D')
   - `decision` ('pass' | 'fail' | 'review')
   - `max_possible_score` (raw sum before normalization)
   - Enhanced `field_results[]` with: `trust_level`, `override_policy`, `override_multiplier`, `trust_multiplier`, `field_max_score`, `field_actual_score`, `risk_contribution` (percentage), `verification_status` ('not_checked' for now — adapters come in Phase 3)
   - `evidence_summary` (only in `full` mode): `total_fields_evaluated`, `fields_passed`, `fields_failed`, `fields_missing`, `top_risk_contributors[]`

4. **Maintain backward compatibility** — If `mode` is not provided, default to `'full'`. Existing fields in the response (`decision`, `total_risk_score`, `field_results`) still work but are now computed by the new engine.

### Acceptance criteria
- [ ] `mode=prescreen` evaluates fewer fields (only include_in_prescreen=true)
- [ ] `mode=full` evaluates all fields and includes evidence_summary
- [ ] Response includes risk_score, quality_score, letter_tier
- [ ] field_results include multiplier details and score breakdown
- [ ] evidence_summary shows top_risk_contributors sorted by contribution
- [ ] Backward compatible — omitting mode defaults to full
- [ ] Source routing (source_type/source_id) still works for template resolution
- [ ] Auth: requires authenticated user with org membership
- [ ] Performance: full evaluation of 40 fields completes in < 500ms

### Data contract
Input: `EvaluateRequest` with added `mode?: 'prescreen' | 'full'`
Output: Enhanced `EvaluateResponse` per spec (specs/underwriting-product.md, Updated Evaluate API Response section)

### Do NOT
- Do not modify check-mcc API — it stays lightweight
- Do not add verification service calls — that's Phase 3
- Do not persist evaluation results — caller handles storage
- Do not build UI — that's tickets 4-7 and Phase 2

### Reference
- Spec: specs/underwriting-product.md, Updated Evaluate API Response section
- Spec: specs/platform-rules-engine.md, existing evaluate API
- Dependencies: GRA-XX (ticket 2 of this set — scoring engine), Rules engine ticket 5 (existing evaluate API)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): wire three-factor scoring to evaluate API (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 4 of 14

Title: [Shared-UI] Admin UI: Trust multiplier configuration — ISO sets trust level weights per data source

Labels: module:shared-ui, type:feature, priority:p1

### Context
Trust multipliers determine how much each data source type contributes to the risk score. This is ISO-configurable — some ISOs trust OCR less, some trust merchant self-reporting more. This ticket adds a configuration panel in the template settings where the admin sets multiplier values per trust level.

### What to build
Add a "Scoring Config" tab (or section within existing template detail page) at `/app/settings/risk-templates/[id]` with a trust multiplier editor.

**UI layout:**
1. **Trust Multipliers table** — Each row shows:
   - Trust Level name (human-readable: "Merchant Self-Reported", "Third-Party Verified", etc.)
   - Description (from `trust_multipliers.description`)
   - Multiplier value (editable number input, 0.01 - 2.00, step 0.01)
   - "Reset to default" link per row
2. **Save button** — Updates all modified multipliers in one call
3. **Info callout** — "Lower multipliers mean the data source contributes less to the risk score. Verified data (lower multiplier) reduces risk contribution because we trust it more."

**API calls:**
- `GET /api/rules/templates/:id/trust-multipliers` — list current multipliers
- `PUT /api/rules/templates/:id/trust-multipliers` — batch update (send all 8 values)

### Acceptance criteria
- [ ] Trust multiplier table renders with all 8 trust levels and current values
- [ ] Number inputs constrained to 0.01 - 2.00 range
- [ ] Save persists changes to `trust_multipliers` table
- [ ] "Reset to default" reverts individual row to seed value without saving others
- [ ] Validation rejects values outside 0.01-2.00 range
- [ ] Info callout explains the multiplier direction clearly
- [ ] Styling matches design-system.md

### Data contract
Input: template_id, trust_multipliers rows
Output: Updated trust_multipliers rows

### Do NOT
- Do not build override multiplier config here — that's the next ticket
- Do not build the scoring preview ("what would this merchant score with these settings") — future enhancement
- Do not modify the scoring engine — consume it as-is

### Reference
- Spec: specs/underwriting-product.md, trust_multipliers table and seed defaults
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 1 of this set — trust_multipliers table must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): trust multiplier config UI (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 5 of 14

Title: [Shared-UI] Admin UI: Override multiplier + letter tier configuration

Labels: module:shared-ui, type:feature, priority:p1

### Context
Override multipliers and letter tier thresholds are part of the Underwriting scoring config that the ISO admin controls. This ticket adds both configurations to the template settings page — they're small enough to combine into one ticket.

### What to build
Add to the "Scoring Config" tab (same page as trust multipliers, ticket 4):

**Section 1: Override Multipliers**
1. Three-row table:
   - "Allowed" — multiplier input (default 0.80)
   - "Allowed with Approval" — multiplier input (default 1.00)
   - "Not Allowed" — multiplier input (default 1.20)
2. Same constraints as trust multipliers (0.01-2.00 range)
3. Info callout: "Higher multipliers mean locked fields contribute more to the score. Fields that cannot be overridden carry more weight because we trust their values."

**Section 2: Letter Tier Thresholds**
1. Four-row config:
   - Tier A: "Quality score above" — number input (default 91)
   - Tier B: "Quality score above" — number input (default 75)
   - Tier C: "Quality score above" — number input (default 25)
   - Tier D: "Below Tier C" (no input, implied)
2. Validation: A > B > C, all between 0-100
3. Two toggles: "Show letter tier in results" / "Show numerical score in results" (both default true)
4. Info callout: "Quality score = 100 minus risk score. A merchant scoring Tier A has the lowest risk."

**API calls:**
- `GET /api/rules/templates/:id/override-multipliers` — current values
- `PUT /api/rules/templates/:id/override-multipliers` — update
- Letter tier values use existing `PUT /api/rules/templates/:id` (they're columns on risk_templates)

### Acceptance criteria
- [ ] Override multiplier table renders with 3 rows and correct defaults
- [ ] Letter tier config renders with 4 tiers and validation (A > B > C)
- [ ] Save persists both sections correctly
- [ ] Validation rejects invalid tier ordering (e.g. B > A)
- [ ] Display toggles update template's show_letter_tier / show_numerical_score
- [ ] "Reset to default" available for both sections
- [ ] Styling matches trust multiplier section and design-system.md

### Data contract
Input: template_id, override_multipliers rows, risk_templates tier columns
Output: Updated override_multipliers + risk_templates

### Do NOT
- Do not duplicate trust multiplier UI (that's ticket 4)
- Do not build scoring preview/simulation
- Do not modify the scoring engine logic

### Reference
- Spec: specs/underwriting-product.md, override_multipliers table and risk_templates additions
- Design reference: Underwriting Rules v1.xlsx (Example Scoring sheet — shows high-risk vs regular tier examples)
- Dependencies: GRA-XX (ticket 1 schema), GRA-XX (ticket 4 creates the parent tab)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): override multiplier and letter tier config (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 6 of 14

Title: [Shared-UI] Admin UI: Pre-screen field toggle — Configure which fields SmartMPA evaluates

Labels: module:shared-ui, type:feature, priority:p1

### Context
SmartMPA inherits Underwriting rules at lower resolution. The ISO admin controls which fields are included in the pre-screen evaluation via an `include_in_prescreen` toggle on each entity rule. This ticket adds that toggle to the existing entity rules admin page (rules engine ticket 6).

### What to build
On the existing entity rules page (`/app/settings/risk-templates/[id]/entity-rules`), add a column/toggle to each field row:

1. **"Pre-screen" toggle** — Boolean switch per field. When ON, SmartMPA evaluates this field. When OFF, only full Underwriting evaluates it.
2. **Visual indicator** — Fields included in pre-screen get a small badge or icon: "📱 Pre-screen" or similar subtle indicator.
3. **Bulk actions** — "Include all required fields" / "Exclude all optional fields" buttons at the top for quick setup.
4. **Save** — Toggle changes save immediately (optimistic update) or batch with other entity rule changes.

**API:** Uses existing `PUT /api/rules/templates/:id/entity-rules/:field` — add `include_in_prescreen` to the payload.

### Acceptance criteria
- [ ] Pre-screen toggle renders on each entity rule row
- [ ] Toggle state matches `include_in_prescreen` value from DB
- [ ] Toggling persists to database correctly
- [ ] "Include all required" sets all is_required=true fields to include_in_prescreen=true
- [ ] "Exclude all optional" sets all is_required=false fields to include_in_prescreen=false
- [ ] Visual badge distinguishes pre-screen fields from full-only fields
- [ ] Default state for new templates: required fields = included, optional = excluded
- [ ] Styling integrates cleanly with existing entity rules table (rules engine ticket 6)

### Data contract
Input: entity_rule field_key + include_in_prescreen boolean
Output: Updated entity_rules row

### Do NOT
- Do not rebuild the entity rules page — add to the existing one from rules engine ticket 6
- Do not modify SmartMPA's evaluate call — it already filters by include_in_prescreen via the scoring engine
- Do not add trust_level configuration here — that's set per field in the entity rules detail, separate concern

### Reference
- Spec: specs/underwriting-product.md, "include_in_prescreen" section
- Decision: 2026-05-03-scoring-display-and-prescreen-config.md
- Dependencies: Rules engine ticket 6 (entity rules page must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): prescreen field toggle (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 7 of 14

Title: [Shared-UI] Admin UI: Trust level + data source per field — Entity rules detail enhancement

Labels: module:shared-ui, type:feature, priority:p1

### Context
Each field in the entity rules needs a `trust_level` assignment (how reliable is the data source for this field) and an optional `data_source` label (which service verifies it). This information drives the scoring formula's trust multiplier. The ISO admin sets these per field as part of their Underwriting configuration.

### What to build
Enhance the entity rules detail/edit view (from rules engine ticket 6) to include:

1. **Trust Level dropdown** per field — Options: Trust Merchant, Verify, Auto-Detect, Auto-Fill, Calculated, Manual, OCR Extract, OCR + Auto-Detect. Displays current selection with a tooltip explaining what each level means.

2. **Data Source field** — Text input showing the verification source (e.g. "OpenCorporates", "TinCheck", "Document"). Optional/informational for now — verification adapters (Phase 3) will read this. For MVP it helps the admin document their intent.

3. **Score preview per row** — Show the calculated `field_max_score` (weight × override_mult × trust_mult × 10) as a read-only value so the admin can see the impact of their configuration changes in real-time.

**API:** Uses existing `PUT /api/rules/templates/:id/entity-rules/:field` — add `trust_level` and `data_source` to the payload.

### Acceptance criteria
- [ ] Trust level dropdown renders with all 8 options on each field row
- [ ] Dropdown selection persists to entity_rules.trust_level
- [ ] Data source text input renders and persists to entity_rules.data_source
- [ ] Score preview updates in real-time when trust_level or override_policy changes
- [ ] Score preview formula matches: risk_weight × override_mult × trust_mult × 10
- [ ] Tooltips explain each trust level option clearly
- [ ] Existing entity rules functionality (required, override, weight, range toggle) unaffected
- [ ] Styling matches existing entity rules table

### Data contract
Input: entity_rule field_key + trust_level + data_source
Output: Updated entity_rules row, computed field_max_score (client-side calculation for preview)

### Do NOT
- Do not build verification service calls — that's Phase 3
- Do not modify the scoring engine — just display its formula result as a preview
- Do not change the trust_multipliers values here — that's on the Scoring Config tab (ticket 4)

### Reference
- Spec: specs/underwriting-product.md, entity_rules additions
- Design reference: Underwriting Rules v1.xlsx (Data Points sheet — columns E/F/G show Source/Trust/Override per field)
- Dependencies: Rules engine ticket 6 (entity rules page), ticket 1 of this set (schema)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): trust level and data source per field (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Phase 2: Underwriter Experience

---

## Ticket 8 of 14

Title: [Underwriting] Evidence pack view — Full scored merchant evaluation with category breakdown

Labels: module:experiment-underwriting, type:feature, priority:p1

### Context
This is the primary Underwriting product surface — where the underwriter sees the full evidence pack for a merchant and makes their decision. It displays the three-factor scoring results in a format designed for decision-making: overall score + tier at the top, category-by-category field breakdown, and risk flags panel.

### What to build
Create the underwriter evidence pack page at `/app/features/underwriting/[merchant_id]/evaluate` (or appropriate route within the Underwriting product module):

1. **Header section:**
   - Merchant name, DBA, MCC code + description, submission date
   - Large score display: numerical score (if show_numerical_score) + letter tier badge (if show_letter_tier)
   - Decision badge: Pass (green) / Fail (red) / Review (yellow) — based on current scoring
   - "Re-evaluate" button to re-run scoring with latest data

2. **Score breakdown bar:**
   - Visual horizontal bar showing quality_score position relative to tier thresholds
   - Markers for tier_a_min, tier_b_min, tier_c_min boundaries
   - Labels: "Auto-Approve" | "Review" | "Auto-Decline" zones

3. **Category tabs:**
   - Tabs matching rule_categories: Entity, Financial, Directors, Business Model, Compliance
   - Each tab shows a data table of fields in that category with columns:
     - Field name (display_name)
     - Value provided (merchant's input)
     - Status icon (✅ ❌ ⚠️ 🔍)
     - Trust level (badge)
     - Score contribution (field_actual_score / total as percentage bar)
     - Data source (badge or text)
   - Sort by risk contribution (highest risk fields first)

4. **Risk flags panel** (sidebar or collapsible):
   - Top 5 risk contributors (field name + contribution %)
   - MCC risk rating
   - Missing required fields list
   - Any binary fail conditions (MATCH hit, etc.)

5. **Evidence summary** (bottom section):
   - Total fields evaluated / passed / failed / missing
   - Verification sources used (list of data_source values that returned results)

**Data source:** Calls `POST /api/rules/evaluate` with `mode=full` on page load. Displays the `EvaluateResponse` in the layout above.

### Acceptance criteria
- [ ] Page loads and displays full evaluation for a given merchant
- [ ] Score display shows numerical and/or letter tier based on template config
- [ ] Score breakdown bar correctly positions score relative to tier boundaries
- [ ] Category tabs show all fields with correct status and score contribution
- [ ] Fields sorted by risk contribution within each category
- [ ] Risk flags panel shows top contributors and missing required fields
- [ ] "Re-evaluate" button re-calls API and refreshes all displayed data
- [ ] Handles edge cases: no data yet (empty state), all fields missing, score = 0
- [ ] Styling matches design-system.md (KPI card for score, data table for fields)
- [ ] Responsive — works on desktop widths used by operations teams

### Data contract
Input: merchant_id (URL param) → merchant_data from merchant record → evaluate API call
Output: Rendered evidence pack view

### Do NOT
- Do not implement the decision workflow (approve/decline buttons) — that's ticket 9
- Do not call external verification services — display whatever the API returns
- Do not persist evaluation results from this page — read-only view that calls evaluate on demand
- Do not build merchant CRUD — this page reads from the shared merchant entity

### Reference
- Spec: specs/underwriting-product.md, "Underwriter UI: Evidence Pack View" section
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 3 — updated evaluate API must return full response)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(underwriting): evidence pack view (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 9 of 14

Title: [Underwriting] Decision workflow — Approve, decline, escalate with underwriter notes

Labels: module:experiment-underwriting, type:feature, priority:p1

### Context
After reviewing the evidence pack, the underwriter makes a decision. This ticket adds the decision actions (approve/decline/request more info/escalate) with required notes, and persists the decision to the merchant record. This is the moment the merchant transitions from "pre-screened" to "applied" → underwriting decision recorded.

### What to build
Add a decision action panel to the evidence pack view (ticket 8):

1. **Decision buttons:**
   - ✅ Approve — merchant passes underwriting
   - ❌ Decline — merchant fails underwriting
   - 📋 Request More Info — merchant needs additional documentation
   - ⬆️ Escalate — passes to senior underwriter / compliance

2. **Decision modal** (opens on button click):
   - Selected action (pre-filled from button)
   - Notes field (required, textarea, min 10 chars)
   - Conditions field (optional, for conditional approvals: "approved with $5k reserve")
   - Confirm button

3. **Schema: `underwriting_decisions`**
   ```sql
   CREATE TABLE underwriting_decisions (
     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     merchant_id     UUID NOT NULL,
     template_id     UUID NOT NULL REFERENCES risk_templates(id),
     org_id          UUID NOT NULL REFERENCES orgs(id),
     decision        TEXT NOT NULL CHECK (decision IN ('approve', 'decline', 'request_info', 'escalate')),
     risk_score      SMALLINT NOT NULL,
     quality_score   SMALLINT NOT NULL,
     letter_tier     TEXT NOT NULL,
     notes           TEXT NOT NULL,
     conditions      TEXT,
     decided_by      UUID NOT NULL REFERENCES profiles(id),
     decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
     snapshot        JSONB NOT NULL          -- Full evaluate response at time of decision
   );
   ```
   RLS: org-scoped reads, admin/underwriter writes.

4. **Post-decision state:**
   - Decision recorded with full scoring snapshot (so we know what the underwriter saw)
   - Merchant status updates (future integration point for merchant entity)
   - UI shows "Decision recorded" confirmation with summary
   - Evidence pack becomes read-only after decision (can re-open with "Revise Decision" for overrides)

**API:**
- `POST /api/underwriting/decisions` — create decision
- `GET /api/underwriting/decisions?merchant_id=xxx` — list decisions for a merchant (audit trail)

### Acceptance criteria
- [ ] Four decision buttons render on evidence pack page
- [ ] Modal opens with correct action pre-filled
- [ ] Notes required (min 10 chars) — cannot submit without
- [ ] Decision persists to underwriting_decisions table with full snapshot
- [ ] Snapshot captures the exact evaluate response at decision time
- [ ] Decision history visible as audit trail on the merchant (list of past decisions)
- [ ] "Revise Decision" allows a new decision to override the previous one
- [ ] RLS ensures decisions are org-scoped
- [ ] Styling matches design-system.md (modal pattern, button colors per action)

### Data contract
Input: merchant_id, decision action, notes, conditions, current evaluate response (snapshot)
Output: underwriting_decisions row, UI confirmation

### Do NOT
- Do not trigger Onboarding submission automatically — that's a separate workflow
- Do not send notifications/emails on decision — future enhancement
- Do not build approval chains/multi-level underwriting — single decision for now
- Do not modify the scoring engine or evaluate API

### Reference
- Spec: specs/underwriting-product.md, Underwriter UI section
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 8 — evidence pack page must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(underwriting): decision workflow (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 10 of 14

Title: [Underwriting] Underwriting queue — List of merchants awaiting review with score/tier badges

Labels: module:experiment-underwriting, type:feature, priority:p1

### Context
The underwriter needs a landing page showing which merchants need review. This is the entry point to the Underwriting product — a queue of merchants with their current score, tier, and decision status, sorted by urgency.

### What to build
Create the underwriting queue page at `/app/features/underwriting/` (product landing):

1. **Queue data table** with columns:
   - Merchant name + DBA
   - MCC (code + short description)
   - Source (from template_assignments — ISV partner, PayFac, etc.)
   - Score (numerical + letter tier badge)
   - Decision status: Pending / Approved / Declined / Needs Info / Escalated
   - Submitted date
   - Assigned to (if multi-underwriter, future — show "Unassigned" for now)
   - Action: "Review" button → navigates to evidence pack (ticket 8)

2. **Filters:**
   - Status filter: All / Pending / Approved / Declined / Needs Info / Escalated
   - Letter tier filter: A / B / C / D
   - Template filter (dropdown of active templates)
   - Date range

3. **Sort:** Default sort by submitted date (newest first). Click column headers to re-sort.

4. **Empty state:** "No merchants awaiting review. Merchants will appear here when they submit applications through SmartMPA."

5. **KPI cards at top:**
   - Pending reviews (count)
   - Approved today (count)
   - Declined today (count)
   - Average processing time (decision_time - submit_time)

**Data source:** Queries merchants with status "applied" (or equivalent) plus their latest evaluate scores. Joins against underwriting_decisions for status.

### Acceptance criteria
- [ ] Queue page renders with data table of merchants pending/completed review
- [ ] Filters work correctly (status, tier, template, date)
- [ ] Score + tier badge displays correctly per merchant
- [ ] "Review" button navigates to evidence pack for that merchant
- [ ] KPI cards show correct counts
- [ ] Empty state displays when no merchants in queue
- [ ] Pagination for large queues (>50 merchants)
- [ ] Styling matches design-system.md (data table pattern, KPI cards)

### Data contract
Input: org_id (from auth), filter params
Output: Paginated list of merchants with scores and decision status

### Do NOT
- Do not build merchant assignment/claiming logic — single underwriter for now
- Do not build batch decision actions (approve all Tier A) — future enhancement
- Do not duplicate the evidence pack view — this is just the list/queue

### Reference
- Spec: specs/underwriting-product.md
- Design system: design-system.md (data table, KPI card patterns)
- Dependencies: GRA-XX (ticket 8 — evidence pack page to navigate to), GRA-XX (ticket 9 — decisions table for status)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(underwriting): underwriting queue page (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Phase 3: Verification Adapters

---

## Ticket 11 of 14

Title: [Shell] Verification adapter interface + runner — Standard pattern for external data source calls

Labels: module:shell, type:feature, priority:p2

### Context
The Underwriting scoring engine needs to call external verification services (OpenCorporates, TinCheck, Ekata, etc.) to validate merchant data. Each service has a different API, but we need a consistent interface so the scoring engine can call any of them the same way. This ticket creates the adapter pattern and the runner that orchestrates verification calls.

### What to build
Create the verification adapter infrastructure at `/lib/verification/`:

1. **Adapter interface:**
   ```typescript
   interface VerificationAdapter {
     source_name: string;
     supported_fields: string[];         // field_keys this adapter can verify
     verify(field_key: string, merchant_value: any, context: MerchantContext): Promise<VerificationResult>;
   }

   interface VerificationResult {
     status: 'verified' | 'mismatch' | 'source_unavailable';
     source_value: any;
     confidence: number;                 // 0-1
     raw_response?: any;                 // For audit trail
     checked_at: string;                 // ISO timestamp
   }

   interface MerchantContext {
     merchant_data: Record<string, any>;  // Full merchant record for cross-referencing
     org_id: string;
   }
   ```

2. **Adapter registry:**
   - Map of source_name → adapter instance
   - `getAdapter(data_source: string): VerificationAdapter | null`
   - Returns null if no adapter registered (field scores at trust_merchant level)

3. **Verification runner:**
   ```typescript
   async function runVerifications(
     fields: EntityRuleWithValue[],       // Fields that need verification
     merchant_context: MerchantContext
   ): Promise<Map<string, VerificationResult>>
   ```
   - Looks up each field's `data_source` in the adapter registry
   - Calls verify() for fields that have a registered adapter
   - Runs adapters in parallel (Promise.allSettled)
   - Returns results map keyed by field_key
   - Handles timeouts (5s per adapter, configurable)
   - Handles failures gracefully (source_unavailable, doesn't break scoring)

4. **Integration point with scoring engine:**
   - Scoring engine optionally calls runner before scoring
   - If verification result is 'verified', field scores at full trust level
   - If 'mismatch', field scores 0 (binary fail)
   - If 'source_unavailable', field scores at trust_merchant level (conservative fallback)

### Acceptance criteria
- [ ] VerificationAdapter interface defined and exported
- [ ] Adapter registry allows registering/looking up adapters by source_name
- [ ] Runner calls all relevant adapters in parallel
- [ ] Runner handles timeouts (5s default) without breaking
- [ ] Runner handles adapter failures gracefully (returns source_unavailable)
- [ ] Scoring engine integrates verification results into field scoring
- [ ] Fields without a registered adapter score normally (no verification attempted)
- [ ] Unit tests: all adapters succeed, some fail, all timeout, no adapters registered

### Data contract
Input: List of fields with data_source + merchant data
Output: Map of field_key → VerificationResult

### Do NOT
- Do not implement any specific adapter (OpenCorporates, TinCheck, etc.) — those are separate tickets
- Do not persist verification results to database — the scoring snapshot in underwriting_decisions captures them
- Do not make verification mandatory — scoring works without it

### Reference
- Spec: specs/underwriting-product.md, Data Source Integrations section
- Dependencies: GRA-XX (ticket 2 — scoring engine to integrate with)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): verification adapter interface and runner (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 12 of 14

Title: [Shell] OpenCorporates verification adapter — Business entity verification

Labels: module:shell, type:feature, priority:p2

### Context
OpenCorporates is the primary verification source for business entity data: legal name, business address, corporate structure, registration status, and principal names. This is the most valuable single adapter because it verifies 5 fields in one call.

### What to build
Implement a VerificationAdapter for OpenCorporates at `/lib/verification/adapters/opencorporates.ts`:

1. **Supported fields:** `legal_business_name`, `business_address`, `corporate_structure`, `business_registration_status`, `principal_name`

2. **API integration:**
   - OpenCorporates REST API (https://api.opencorporates.com)
   - Search by company name + jurisdiction
   - Match confidence based on name similarity (fuzzy match)
   - Extract: registered address, company type, current status, officers

3. **Verification logic per field:**
   - `legal_business_name`: Fuzzy match merchant's name against OpenCorporates result. Confidence based on similarity score. Verified if > 0.85 match.
   - `business_address`: Compare registered address to merchant's. Verified if normalized addresses match (ignore formatting differences).
   - `corporate_structure`: Map OpenCorporates company_type to Gratify's categories (LLC, Corp, Sole Prop, etc.)
   - `business_registration_status`: Check if company status is "Active" / "Good Standing"
   - `principal_name`: Check if merchant's stated principal appears in officers list

4. **Config:** API key stored as environment variable `OPENCORPORATES_API_KEY`. Rate limiting: respect API limits (configurable delay between calls).

### Acceptance criteria
- [ ] Adapter implements VerificationAdapter interface correctly
- [ ] Registers as supported for all 5 fields
- [ ] API call to OpenCorporates succeeds and returns parsed results
- [ ] Fuzzy name matching produces reasonable confidence scores
- [ ] Address normalization handles common formatting differences
- [ ] Returns 'source_unavailable' on API timeout or error (doesn't throw)
- [ ] API key configurable via environment variable
- [ ] Rate limiting prevents exceeding API quotas
- [ ] Unit tests with mocked API responses for all 5 field types

### Data contract
Input: field_key + merchant's value + MerchantContext
Output: VerificationResult with OpenCorporates data in source_value

### Do NOT
- Do not modify the adapter interface — implement it as defined in ticket 11
- Do not persist results — the runner/scoring engine handles that
- Do not build a UI for OpenCorporates config — env var for now
- Do not handle billing/metering for API calls — future concern

### Reference
- Spec: specs/underwriting-product.md, Data Source Integrations table
- Design reference: Underwriting Rules v1.xlsx (Data Points — OpenCorporates fields)
- Dependencies: GRA-XX (ticket 11 — adapter interface must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): opencorporates verification adapter (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 13 of 14

Title: [Shell] TinCheck verification adapter — EIN/Tax ID verification

Labels: module:shell, type:feature, priority:p2

### Context
TinCheck verifies EIN (Employer Identification Number) / Tax ID against IRS records. This is a critical fraud signal — a mismatched or invalid EIN is a major red flag. It's also a simple adapter (one field, binary result), making it a good early win.

### What to build
Implement a VerificationAdapter for TinCheck at `/lib/verification/adapters/tincheck.ts`:

1. **Supported fields:** `ein`

2. **API integration:**
   - TinCheck REST API
   - Submit EIN + legal business name
   - Returns: match/no match, business name on file, status

3. **Verification logic:**
   - `ein`: Submit merchant's EIN + legal_business_name to TinCheck. 'verified' if EIN is valid AND business name matches. 'mismatch' if EIN is valid but name doesn't match (possible fraud signal). 'source_unavailable' on API error.

4. **Confidence scoring:**
   - Exact name match: confidence 1.0
   - Close match (abbreviation differences, "LLC" vs "L.L.C."): confidence 0.9
   - No name match but valid EIN: confidence 0.5 (flag for review)

5. **Config:** API credentials via environment variables `TINCHECK_API_KEY`, `TINCHECK_API_URL`.

### Acceptance criteria
- [ ] Adapter implements VerificationAdapter interface
- [ ] Registers as supported for `ein` field
- [ ] API call to TinCheck succeeds with valid EIN
- [ ] Returns 'verified' for matching EIN + name
- [ ] Returns 'mismatch' for valid EIN with wrong name
- [ ] Returns 'source_unavailable' on API failure
- [ ] Confidence scoring reflects match quality
- [ ] API credentials configurable via environment variables
- [ ] Unit tests with mocked responses: match, mismatch, invalid EIN, API failure

### Data contract
Input: field_key='ein' + merchant's EIN value + MerchantContext (has legal_business_name)
Output: VerificationResult with TinCheck response data

### Do NOT
- Do not verify SSN/SIN here — that would be a different adapter with different compliance requirements
- Do not store raw EIN values in logs — sensitive data handling required
- Do not modify the adapter interface

### Reference
- Spec: specs/underwriting-product.md, Data Source Integrations table
- Design reference: Underwriting Rules v1.xlsx (Data Points row 6 — EIN field, Data Source: TinCheck)
- Dependencies: GRA-XX (ticket 11 — adapter interface must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): tincheck verification adapter (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 14 of 14

Title: [Shell] Ekata verification adapter — Phone and email domain verification

Labels: module:shell, type:feature, priority:p2

### Context
Ekata verifies phone numbers and email domains as fraud signals. A VoIP number or free email domain (gmail on a business claiming $1M revenue) are risk indicators. This adapter covers two fields with one service integration.

### What to build
Implement a VerificationAdapter for Ekata at `/lib/verification/adapters/ekata.ts`:

1. **Supported fields:** `phone_number`, `principal_email_domain`

2. **API integration:**
   - Ekata Identity Check API
   - Phone: validates number is active, identifies carrier type (landline/mobile/VoIP)
   - Email: validates domain, identifies if free provider or custom business domain

3. **Verification logic:**
   - `phone_number`: 'verified' if number is active and matches business location (area code reasonable for business_address). 'mismatch' if VoIP/prepaid (flag as risk signal). Confidence based on carrier type: landline/business = 1.0, mobile = 0.8, VoIP = 0.5.
   - `principal_email_domain`: 'verified' if custom domain matching business website. 'mismatch' if free provider (gmail, yahoo, hotmail) on a business with website. Confidence: exact domain match = 1.0, custom non-matching = 0.8, free provider = 0.3.

4. **Config:** API credentials via `EKATA_API_KEY`.

### Acceptance criteria
- [ ] Adapter implements VerificationAdapter interface
- [ ] Registers as supported for `phone_number` and `principal_email_domain`
- [ ] Phone verification identifies carrier type correctly
- [ ] Email verification distinguishes free vs custom domain
- [ ] Returns appropriate confidence levels per carrier/domain type
- [ ] Returns 'source_unavailable' on API failure
- [ ] API credentials configurable via environment variable
- [ ] Unit tests with mocked responses: valid landline, VoIP, free email, custom email, failures

### Data contract
Input: field_key + merchant's phone/email + MerchantContext
Output: VerificationResult with Ekata response data (carrier info or domain analysis)

### Do NOT
- Do not verify email deliverability (whether the email receives mail) — just domain analysis
- Do not block on VoIP/free email — flag as risk signal, scoring handles the weight
- Do not modify the adapter interface
- Do not store full phone numbers in logs — PII handling required

### Reference
- Spec: specs/underwriting-product.md, Data Source Integrations table
- Design reference: Underwriting Rules v1.xlsx (Data Points rows 8, 37 — Phone, Email Domain)
- Dependencies: GRA-XX (ticket 11 — adapter interface must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): ekata verification adapter (GRA-XX)`
4. Blocking: comment, stop, notify Ryan
