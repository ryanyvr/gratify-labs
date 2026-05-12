# Gratify One — Platform Rules Engine Spec
**Version:** 1.0  
**Date:** May 2026  
**Owner:** Ryan (CEO, Gratify)  
**Level:** Platform (shared across all products)

---

## What This Is

A configurable rules engine that allows ISO admins and acquirers to define their risk appetite, prohibited MCCs, entity requirements, and scoring thresholds — once — and have those rules enforced automatically across Scout, SmartMPA, and Onboarding.

This is **not** a feature of any single product. It is platform infrastructure that every product reads from. An ISO admin configures their rules in Settings, and those rules cascade through the entire merchant lifecycle.

---

## Why It Matters

Without this, each product implements its own version of "should we board this merchant?" That means:
- Scout might let a rep walk into a CBD shop that the ISO will never board
- SmartMPA might accept an application that Onboarding will instantly decline
- Rule changes require updating three different products

With a shared engine: configure once, enforce everywhere. Same data source, different depth of application per product.

---

## How Each Product Consumes Rules

| Product | What it reads | What it does with it | Confidence level |
|---|---|---|---|
| **Scout** | MCC allow/block list only | Knockout check on estimated MCC. "Walk past — your ISO doesn't board this MCC." | Low (estimated MCC from Google Places category) |
| **SmartMPA** | MCC rules + Entity rules + Risk weights | Boardability pre-screen. Thumbs up/down based on full rule evaluation against application data. | Medium (rep-confirmed MCC, partial entity data) |
| **Onboarding** | Full rule set including overrides, ranges, scoring | Automated underwriting decision (approve/decline/escalate) with audit trail. | High (verified entity data, confirmed MCC) |

---

## Data Model (Supabase)

**Dependencies:** This spec assumes the `orgs` and `profiles` tables from the Cycle 1 platform schema (GRA-24) already exist. All tables below have RLS enabled — policies are defined in the RLS section at the end of this data model.

### `risk_templates`

The top-level container. Each template represents a set of rules for a specific acquiring relationship.

```sql
CREATE TABLE risk_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  name            TEXT NOT NULL,                    -- e.g. "Esquire Bank", "ISO Agent 1"
  is_active       BOOLEAN NOT NULL DEFAULT false,   -- Allow toggle from wireframe
  fail_above      SMALLINT NOT NULL DEFAULT 70,     -- Risk score above this = auto-decline
  review_above    SMALLINT NOT NULL DEFAULT 40,     -- Risk score above this = manual review
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES profiles(id),
  
  UNIQUE(org_id, name)
);
```

**Why multiple templates per org:** An ISO might board through Esquire Bank for retail and a different acquirer for restaurants. Each relationship has different risk appetite. The `is_active` toggle lets admins activate/deactivate templates without deleting them.

---

### `mcc_groups`

Groups of MCC codes with allow/block at the group level. Maps directly to the wireframe's "Merchant Category Codes" table.

```sql
CREATE TABLE mcc_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES risk_templates(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                    -- e.g. "Retail Outlet Services"
  mcc_range_start SMALLINT NOT NULL,               -- e.g. 5000
  mcc_range_end   SMALLINT NOT NULL,               -- e.g. 5599
  is_allowed      BOOLEAN NOT NULL DEFAULT true,    -- Group-level allow toggle
  
  UNIQUE(template_id, mcc_range_start)
);
```

---

### `mcc_rules`

Individual MCC code rules within a group. Maps to the wireframe's drill-down "Edit Codes" view.

```sql
CREATE TABLE mcc_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES mcc_groups(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES risk_templates(id) ON DELETE CASCADE,
  mcc_code        SMALLINT NOT NULL,               -- e.g. 5094
  description     TEXT NOT NULL,                    -- e.g. "Precious Stones and Metals, Watches and Jewelry"
  is_allowed      BOOLEAN NOT NULL DEFAULT true,    -- Individual MCC allow toggle
  est_refund_pct  NUMERIC(5,2),                    -- Estimated refund % (from wireframe)
  est_chargeback_pct NUMERIC(5,2),                 -- Estimated chargeback % (from wireframe)
  risk_rating     TEXT CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
  
  UNIQUE(template_id, mcc_code)
);

-- Index for the hot path: "is this MCC allowed?"
CREATE INDEX idx_mcc_rules_lookup ON mcc_rules(template_id, mcc_code, is_allowed);
```

**Resolution logic:** An MCC is blocked if either the group OR the individual code is blocked. Group block = all codes in range blocked. Individual block = just that code.

---

### `rule_categories`

The tab groups from the wireframe: Entity, Financial, Directors, Business Model, Compliance.

```sql
CREATE TABLE rule_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,             -- e.g. "entity", "financial", "directors"
  name            TEXT NOT NULL,                    -- e.g. "Entity", "Financial"
  display_order   SMALLINT NOT NULL,
  description     TEXT
);

-- Seed data (matches wireframe tabs)
INSERT INTO rule_categories (slug, name, display_order) VALUES
  ('entity', 'Entity', 1),
  ('financial', 'Financial', 2),
  ('directors', 'Directors', 3),
  ('business_model', 'Business Model', 4),
  ('compliance', 'Compliance', 5);
```

---

### `entity_rules`

Per-field rules with required/override/risk-weight settings. Maps to the wireframe's "Entity Rules" table.

```sql
CREATE TABLE entity_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES risk_templates(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES rule_categories(id),
  field_key       TEXT NOT NULL CHECK (field_key IN (
    'legal_business_name', 'dba_name', 'ein', 'business_address', 'phone_number',
    'years_in_business', 'corporate_structure', 'business_registration_status',
    'annual_volume', 'average_ticket', 'monthly_volume', 'chargeback_ratio',
    'principal_name', 'principal_ssn', 'principal_dob', 'principal_ownership_pct',
    'website_url', 'bank_account_verified'
  )),                                               -- Canonical field registry — add new fields here
  display_name    TEXT NOT NULL,                    -- e.g. "Legal Business Name", "EIN / Business Number"
  is_required     BOOLEAN NOT NULL DEFAULT true,    -- Required toggle
  override_policy TEXT NOT NULL DEFAULT 'not_allowed'
    CHECK (override_policy IN ('allowed', 'with_approval', 'not_allowed')),
  risk_weight     SMALLINT NOT NULL DEFAULT 5,      -- 0-10 scale
  has_range_rules BOOLEAN NOT NULL DEFAULT false,   -- Whether this field uses range-based scoring
  display_order   SMALLINT NOT NULL DEFAULT 0,
  
  UNIQUE(template_id, field_key)
);
```

---

### `range_rules`

Range-based scoring rules (e.g., "Years in Business" → risk weight by range). Maps to the wireframe's range editor modal.

```sql
CREATE TABLE range_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_rule_id  UUID NOT NULL REFERENCES entity_rules(id) ON DELETE CASCADE,
  range_start     NUMERIC(12,2) NOT NULL,          -- e.g. 0
  range_end       NUMERIC(12,2) NOT NULL,          -- e.g. 1
  risk_weight     SMALLINT NOT NULL,               -- e.g. 10 (highest risk for newest businesses)
  
  UNIQUE(entity_rule_id, range_start),
  CHECK (range_end > range_start)
);

-- Validation (enforced in API, not DB):
-- 1. Gap detection: range_end of row N must equal range_start of row N+1
-- 2. Overlap detection: no two ranges for the same entity_rule_id may overlap
-- 3. Both gaps and overlaps are rejected on save with descriptive error messages
-- Maps to wireframe's "There is a gap in the range" warning
```

---

## API Layer

All products call the same API. The API returns the right depth of information based on what the caller asks for.

### `GET /api/rules/check-mcc`

**Called by:** Scout, SmartMPA, Onboarding  
**Purpose:** "Is this MCC allowed for this org's active templates?"  
**Why GET:** This is an idempotent read on a hot path (called for every Scout lookup). GET enables HTTP caching and CDN edge caching for repeated lookups of the same MCC by the same org.

```typescript
// Query params: ?org_id=xxx&mcc_code=5993&template_id=yyy (template_id optional)
interface CheckMccRequest {
  org_id: string;
  mcc_code: number;
  template_id?: string;     // Optional: check specific template. If omitted, checks all active templates.
}

// Response
interface CheckMccResponse {
  is_allowed: boolean;
  blocked_by?: {
    template_name: string;
    template_id: string;
    reason: 'group_blocked' | 'code_blocked';
    group_name?: string;
  }[];
  risk_metadata?: {         // Only returned if caller requests it (SmartMPA, Onboarding)
    est_refund_pct: number | null;
    est_chargeback_pct: number | null;
    risk_rating: string | null;
  };
}
```

**Scout usage:** Calls with estimated MCC from Google Places. Gets back `is_allowed: false` → "Walk past — your ISO doesn't board [MCC description]." Scout ignores `risk_metadata`.

**SmartMPA usage:** Calls with rep-confirmed MCC. Gets back full response including risk metadata. Uses it for thumbs up/down calculation.

---

### `POST /api/rules/evaluate`

**Called by:** SmartMPA, Onboarding (NOT Scout — too heavy for pre-visit screening)  
**Purpose:** Full rule evaluation against merchant application data.

```typescript
// Request
interface EvaluateRequest {
  org_id: string;
  template_id?: string;          // Optional if source routing is used (see Template Assignments)
  source_type?: string;          // Automatic template resolution via assignments
  source_id?: string;
  merchant_data: {
    mcc_code: number;
    legal_business_name?: string;
    dba_name?: string;
    ein?: string;
    business_address?: string;
    phone?: string;
    years_in_business?: number;
    corporate_structure?: string;
    registration_status?: string;
    // ... additional fields per category
  };
}

// Response
interface EvaluateResponse {
  decision: 'pass' | 'fail' | 'review';
  total_risk_score: number;
  max_possible_score: number;
  mcc_check: {
    is_allowed: boolean;
    risk_rating: string | null;
  };
  field_results: {
    field_key: string;
    display_name: string;
    status: 'pass' | 'fail' | 'missing' | 'review';
    risk_weight: number;
    risk_contribution: number;   // Actual risk points contributed
    override_policy: string;
    value_provided: any | null;
    message?: string;            // e.g. "EIN is required but not provided"
  }[];
  flags: string[];               // e.g. ["missing_required_field:ein", "high_risk_mcc"]
}
```

**SmartMPA usage:** Calls during pre-screen. `decision: 'fail'` = thumbs down. `decision: 'pass'` = thumbs up. `decision: 'review'` = "might be boardable, needs human review."

**Onboarding usage:** Calls during underwriting. Same evaluation but with verified data and full audit trail logged.

---

### `GET /api/rules/templates`

**Called by:** Admin UI  
**Purpose:** List templates for the org.

### `POST /api/rules/templates`

**Called by:** Admin UI  
**Purpose:** Create/update template.

### `GET /api/rules/templates/:id/mcc`

**Called by:** Admin UI  
**Purpose:** Get MCC groups and codes for a template.

### `PUT /api/rules/templates/:id/mcc/:code`

**Called by:** Admin UI  
**Purpose:** Toggle individual MCC code.

### `GET /api/rules/templates/:id/entity-rules`

**Called by:** Admin UI  
**Purpose:** Get entity rules for a template by category.

### `PUT /api/rules/templates/:id/entity-rules/:field`

**Called by:** Admin UI  
**Purpose:** Update entity rule (required, override policy, risk weight).

### `PUT /api/rules/templates/:id/entity-rules/:field/ranges`

**Called by:** Admin UI  
**Purpose:** Update range rules for a field. Validates for gaps and overlaps.

---

## Row Level Security (RLS)

All tables have RLS enabled. Policies ensure org isolation.

```sql
-- All tables: ENABLE ROW LEVEL SECURITY

-- risk_templates: org members can SELECT, iso_admin/labs_admin can INSERT/UPDATE/DELETE
CREATE POLICY "org_read" ON risk_templates FOR SELECT USING (
  org_id IN (SELECT org_id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "admin_write" ON risk_templates FOR ALL USING (
  org_id IN (SELECT org_id FROM profiles WHERE user_id = auth.uid() 
    AND role IN ('iso_admin', 'labs_admin'))
);

-- All child tables (mcc_groups, mcc_rules, entity_rules, range_rules):
-- Access is scoped through template_id → risk_templates.org_id
-- Same pattern: org members can SELECT, admins can write
-- Implementation: join through template_id to risk_templates to check org_id

-- mcc_reference, rule_categories: public read, no write (seed data only)
```

---

## Admin UI Location

The rules engine admin UI lives in the **Settings** area of Gratify One, not under any specific product. It's accessible to `iso_admin` and `labs_admin` roles.

**Nav path:** Settings → Risk Templates → [Template Name] → Entity / Financial / Directors / Business Model / Compliance → MCC Rules / Entity Rules

This matches the wireframe's breadcrumb: `Dashboard / Underwriting Templates / High Risk`

Updated for Gratify One, the breadcrumb would be: `Settings / Risk Templates / [Template Name]`

---

## Template Assignments (Source/Channel Routing)

An ISO or acquirer may have different rules for different sources — an ISV partner that only boards gyms, a high-risk PayFac that won't touch eCommerce, or an agent group with a restricted vertical. Template assignments map sources to templates so the system automatically applies the right rules without the rep choosing manually.

### `template_assignments`

```sql
CREATE TABLE template_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES risk_templates(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES orgs(id),
  source_type     TEXT NOT NULL CHECK (source_type IN (
    'isv_partner', 'payfac', 'agent_group', 'channel', 'default'
  )),
  source_id       TEXT,                             -- External reference (partner org ID, group slug, channel name)
  source_label    TEXT NOT NULL,                    -- Human-readable: "FitTech ISV", "High Risk PayFac", "East Coast Team"
  priority        SMALLINT NOT NULL DEFAULT 0,      -- Higher = takes precedence when multiple match
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, source_type, source_id)
);

-- Index for resolver hot path
CREATE INDEX idx_template_assignments_lookup 
  ON template_assignments(org_id, source_type, source_id);
```

**Source types:**

| source_type | Use case | source_id example |
|---|---|---|
| `isv_partner` | ISV referral channel — restricts to specific verticals | Partner org UUID or external ID |
| `payfac` | PayFac relationship — different risk appetite per facilitator | PayFac org UUID |
| `agent_group` | Sales team/group with restricted verticals | Group slug: `"east-coast"`, `"high-risk-team"` |
| `channel` | Lead source channel (web, API, referral) | `"api"`, `"web_app"`, `"referral_link"` |
| `default` | Fallback when no other assignment matches | `NULL` — one per org |

**Resolution logic:**

```typescript
// Template resolver — called by check-mcc and evaluate APIs when no template_id is provided
async function resolveTemplate(org_id: string, source?: { type: string; id: string }): Promise<string> {
  // 1. If source provided, find exact match
  if (source) {
    const match = await db.from('template_assignments')
      .select('template_id')
      .eq('org_id', org_id)
      .eq('source_type', source.type)
      .eq('source_id', source.id)
      .single();
    if (match) return match.template_id;
  }
  
  // 2. Fall back to default assignment
  const fallback = await db.from('template_assignments')
    .select('template_id')
    .eq('org_id', org_id)
    .eq('source_type', 'default')
    .single();
  if (fallback) return fallback.template_id;
  
  // 3. No assignment — check all active templates (existing behavior)
  return null; // Signals caller to check all active templates
}
```

**Examples:**
- "FitTech ISV" assignment → maps to a template that only allows MCC 7941 (Health Clubs). Merchant comes in via FitTech API → system auto-selects the gym-only template. Rep never sees non-gym MCCs as boardable.
- "High Risk PayFac" assignment → maps to a template that blocks all eCommerce MCCs (5815-5818, 5964, etc.). Applications from that PayFac auto-apply the restricted rules.
- "default" assignment → the catch-all template used when a merchant comes in through the main portal with no specific source attribution.

**RLS:** Same pattern as other child tables — scoped through `org_id`, admin-only writes.

---

### API Updates for Source Routing

The `check-mcc` and `evaluate` endpoints gain an optional `source` parameter:

```typescript
// check-mcc gains optional source routing
// GET /api/rules/check-mcc?org_id=xxx&mcc_code=5993&source_type=isv_partner&source_id=fittech-uuid
interface CheckMccRequest {
  org_id: string;
  mcc_code: number;
  template_id?: string;          // Explicit template (overrides source routing)
  source_type?: string;          // Used for automatic template resolution
  source_id?: string;            // Used with source_type
}

// evaluate gains optional source routing
interface EvaluateRequest {
  org_id: string;
  template_id?: string;          // Explicit (overrides source routing)
  source_type?: string;          // Automatic template resolution
  source_id?: string;
  merchant_data: { ... };
}
```

**Priority:** If `template_id` is provided, it's used directly (explicit override). If only `source_type`/`source_id` are provided, the resolver picks the assigned template. If neither, falls back to default or checks all active templates.

---

### Admin UI: Template Assignments

**Nav path:** Settings → Risk Templates → [Template Name] → Sources tab

The admin UI gains a "Sources" tab on each template detail page where the ISO admin can:
1. Assign which sources/channels use this template
2. See at a glance: "This template is used by: FitTech ISV, East Coast Team"
3. Set a template as the org's default (only one default allowed)

This maps naturally to your wireframe's template detail pages — it's an additional tab alongside MCC Rules and Entity Rules.

---

## MCC Reference Data

The system needs a master MCC reference table — the canonical list of all MCC codes, descriptions, groups, and default risk metadata. This is seeded once and rarely changes.

```sql
CREATE TABLE mcc_reference (
  mcc_code        SMALLINT PRIMARY KEY,
  description     TEXT NOT NULL,
  group_name      TEXT NOT NULL,
  group_range_start SMALLINT NOT NULL,
  group_range_end SMALLINT NOT NULL,
  default_risk_rating TEXT DEFAULT 'medium',
  default_est_refund_pct NUMERIC(5,2),
  default_est_chargeback_pct NUMERIC(5,2)
);
```

When an ISO admin creates a new template, the system seeds all MCC groups and codes from `mcc_reference` with defaults. The admin then customizes.

---

## Seed Data Flow

1. Admin clicks "New Template" → system creates `risk_template` row
2. System copies all groups from `mcc_reference` into `mcc_groups` (all allowed by default)
3. System copies all codes from `mcc_reference` into `mcc_rules` (all allowed by default)
4. System creates default `entity_rules` for all standard fields (all required, no override, weight 5)
5. Admin customizes: blocks MCCs, adjusts weights, sets override policies, configures ranges

---

## Edge Cases and Validation

**MCC estimation confidence:** Scout works with estimated MCCs. What if Google says "convenience store" (MCC 5411 — Grocery Stores) but it's actually a smoke shop (MCC 5993)? Scout should:
1. Show the estimated MCC and its allow/block status
2. Always label it as "estimated — confirm during application"
3. If the estimated MCC maps to multiple possible codes with different allow statuses, flag it as "⚠️ MCC uncertain — could be blocked depending on actual classification"

**Template conflicts:** An org could have multiple active templates with conflicting MCC rules (one acquirer allows 5993, another doesn't). Scout should check against all active templates and show: "Allowed by Esquire Bank, blocked by Bank B."

**Gap detection:** The range editor (wireframe Screen 5) validates that ranges are contiguous. The API should enforce this: if Years in Business has ranges 0-1, 1-2, 3-5, 5+ — there's a gap at 2-3. The UI shows a warning, the API rejects the save until fixed.

**Empty fields:** When SmartMPA evaluates a partial application, missing required fields contribute their full risk weight as penalty. Missing optional fields contribute zero.

---

## What's NOT In This Spec

- **Sanctions screening (OFAC, etc.):** Lives in SmartMPA, not in the rules engine. Sanctions are not configurable per ISO — they're regulatory. SmartMPA calls an external sanctions API directly.
- **BBB complaint checks:** Same — SmartMPA feature, not configurable per ISO.
- **Billing/metering:** Out of scope for beta.
- **Rule versioning/audit log:** Future enhancement. For now, `updated_at` and `updated_by` track last change but not history.
- **Bulk import/export of rules:** Future. Admins configure via UI only.

---

## Implementation Priority

This is **Cycle 2** infrastructure — it unblocks both Scout (MCC knockout) and SmartMPA (full boardability pre-screen).

**Suggested ticket breakdown:**

1. **Schema + seed data** — Create tables (including `template_assignments`), seed MCC reference data, RLS policies
2. **`check-mcc` API** — The lightweight endpoint Scout calls, with source routing support. Ship this first to unblock Scout development.
3. **Admin UI: Template list** — CRUD for risk templates (wireframe Screen 1)
4. **Admin UI: MCC groups + codes** — Allow/block toggles with drill-down (wireframe Screens 2-3)
5. **`evaluate` API** — The full evaluation endpoint SmartMPA calls, with source routing
6. **Admin UI: Entity rules** — Per-field rules with override policies (wireframe Screen 4)
7. **Admin UI: Range editor** — Modal for range-based scoring with gap detection (wireframe Screen 5)
8. **Scout integration** — Wire Scout's orchestrator to call `check-mcc` with source context
9. **SmartMPA integration** — Wire SmartMPA's pre-screen to call `evaluate` with source context
10. **Admin UI: Template assignments (Sources tab)** — Assign ISV partners, PayFacs, agent groups, and channels to templates

Tickets 1-2 can ship independently and immediately unblock Scout.

---

## Red Team Report (v1)

The following issues were identified during internal red team review and have been addressed in this spec:

**Fixed in this version:**
- Added RLS policies for all tables (was only on `risk_templates`)
- Changed `check-mcc` from POST to GET for HTTP caching on hot path
- Added `fail_above` and `review_above` score thresholds to `risk_templates`
- Added canonical `field_key` registry as CHECK constraint on `entity_rules`
- Added overlap detection requirement alongside gap detection for `range_rules`
- Clarified `orgs` table dependency (exists from Cycle 1 GRA-24)

**Accepted as known debt (fine for beta):**
- `rule_categories` is global, not per-org (custom categories deferred)
- No pagination on MCC list endpoint (fine at beta volume)
- `POST /api/rules/templates` handles both create and update (clarify in ticket as upsert-on-name)
- MCC group range overlap is validated in application logic, not DB constraints

**Accepted risks:**
- MCC reference seed data source needs to be specified in the schema ticket (Visa/MC published list)
- Template conflict display logic ("Allowed by X, blocked by Y") needs UI design in the Scout build chat
