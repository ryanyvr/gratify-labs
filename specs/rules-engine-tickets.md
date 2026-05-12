# Rules Engine — Linear Tickets (Cycle 2)

All tickets use the Gratify Labs project (GRA-xx). Module label: `module:shell` for platform infrastructure, `module:shared-ui` for admin UI components.

---

## Ticket 1 of 10

Title: [Shell] Create rules engine schema + seed MCC reference data

Labels: module:shell, type:schema, priority:p0

### Context
The rules engine is platform-level infrastructure that Scout, SmartMPA, and Onboarding all consume. This ticket creates the Supabase schema and seeds the MCC reference table. It unblocks every other rules engine ticket.

### What to build
Create a Supabase migration that produces the following tables:

1. **`mcc_reference`** — Master MCC lookup table. Columns: `mcc_code` (SMALLINT PK), `description` (TEXT NOT NULL), `group_name` (TEXT NOT NULL), `group_range_start` (SMALLINT NOT NULL), `group_range_end` (SMALLINT NOT NULL), `default_risk_rating` (TEXT DEFAULT 'medium'), `default_est_refund_pct` (NUMERIC(5,2)), `default_est_chargeback_pct` (NUMERIC(5,2)). Seed with the full Visa/Mastercard MCC list (~800 codes). Source: use the ISO 18245 standard MCC list. Group ranges follow the standard groupings (Agricultural Services 0001-1499, Contracted Services 1500-2999, Airlines 3000-3299, Car Rental 3300-3499, Lodging 3500-3999, Transportation 4000-4799, Utilities 4800-4999, Retail Outlet Services 5000-5599, Clothing Stores 5600-5699, Miscellaneous Stores 5700-7299, Business Services 7300-7999, Professional Services 8000-8999, Government Services 9000-9999).

2. **`risk_templates`** — Columns: `id` (UUID PK), `org_id` (UUID NOT NULL FK → orgs), `name` (TEXT NOT NULL), `is_active` (BOOLEAN DEFAULT false), `fail_above` (SMALLINT DEFAULT 70), `review_above` (SMALLINT DEFAULT 40), `created_by` (UUID FK → profiles), `created_at` (TIMESTAMPTZ DEFAULT now()), `updated_at` (TIMESTAMPTZ DEFAULT now()), `updated_by` (UUID FK → profiles). UNIQUE on (org_id, name).

3. **`mcc_groups`** — Columns: `id` (UUID PK), `template_id` (UUID FK → risk_templates ON DELETE CASCADE), `name` (TEXT NOT NULL), `mcc_range_start` (SMALLINT NOT NULL), `mcc_range_end` (SMALLINT NOT NULL), `is_allowed` (BOOLEAN DEFAULT true). UNIQUE on (template_id, mcc_range_start).

4. **`mcc_rules`** — Columns: `id` (UUID PK), `group_id` (UUID FK → mcc_groups ON DELETE CASCADE), `template_id` (UUID FK → risk_templates ON DELETE CASCADE), `mcc_code` (SMALLINT NOT NULL), `description` (TEXT NOT NULL), `is_allowed` (BOOLEAN DEFAULT true), `est_refund_pct` (NUMERIC(5,2)), `est_chargeback_pct` (NUMERIC(5,2)), `risk_rating` (TEXT CHECK IN ('low','medium','high','critical')). UNIQUE on (template_id, mcc_code). Create index `idx_mcc_rules_lookup` on (template_id, mcc_code, is_allowed).

5. **`rule_categories`** — Columns: `id` (UUID PK), `slug` (TEXT UNIQUE), `name` (TEXT NOT NULL), `display_order` (SMALLINT NOT NULL), `description` (TEXT). Seed with: entity (1), financial (2), directors (3), business_model (4), compliance (5).

6. **`entity_rules`** — Columns: `id` (UUID PK), `template_id` (UUID FK → risk_templates ON DELETE CASCADE), `category_id` (UUID FK → rule_categories), `field_key` (TEXT NOT NULL, CHECK constraint with canonical registry: legal_business_name, dba_name, ein, business_address, phone_number, years_in_business, corporate_structure, business_registration_status, annual_volume, average_ticket, monthly_volume, chargeback_ratio, principal_name, principal_ssn, principal_dob, principal_ownership_pct, website_url, bank_account_verified), `display_name` (TEXT NOT NULL), `is_required` (BOOLEAN DEFAULT true), `override_policy` (TEXT DEFAULT 'not_allowed', CHECK IN ('allowed','with_approval','not_allowed')), `risk_weight` (SMALLINT DEFAULT 5), `has_range_rules` (BOOLEAN DEFAULT false), `display_order` (SMALLINT DEFAULT 0). UNIQUE on (template_id, field_key).

7. **`range_rules`** — Columns: `id` (UUID PK), `entity_rule_id` (UUID FK → entity_rules ON DELETE CASCADE), `range_start` (NUMERIC(12,2) NOT NULL), `range_end` (NUMERIC(12,2) NOT NULL), `risk_weight` (SMALLINT NOT NULL). UNIQUE on (entity_rule_id, range_start). CHECK (range_end > range_start).

8. **`template_assignments`** — Columns: `id` (UUID PK), `template_id` (UUID FK → risk_templates ON DELETE CASCADE), `org_id` (UUID NOT NULL FK → orgs), `source_type` (TEXT NOT NULL, CHECK IN ('isv_partner','payfac','agent_group','channel','default')), `source_id` (TEXT, nullable — NULL for 'default' type), `source_label` (TEXT NOT NULL), `priority` (SMALLINT DEFAULT 0), `created_at` (TIMESTAMPTZ DEFAULT now()). UNIQUE on (org_id, source_type, source_id). Create index `idx_template_assignments_lookup` on (org_id, source_type, source_id).

Enable RLS on all tables. Policies:
- `mcc_reference`, `rule_categories`: public read (SELECT for all authenticated), no write
- `risk_templates`: SELECT for org members (join profiles on user_id = auth.uid()), INSERT/UPDATE/DELETE for iso_admin or labs_admin roles only
- `mcc_groups`, `mcc_rules`, `entity_rules`, `range_rules`: SELECT/INSERT/UPDATE/DELETE scoped through template_id → risk_templates → org_id, admin roles only for writes

Also create a Supabase database function `seed_template(template_id UUID)` that copies all MCC groups and codes from `mcc_reference` into `mcc_groups` and `mcc_rules` for the given template (all allowed by default), and creates default `entity_rules` for all field_key values (all required, override not_allowed, weight 5).

### Acceptance criteria
- [ ] All 8 tables created with correct columns, types, constraints, and foreign keys
- [ ] `mcc_reference` seeded with 700+ MCC codes covering all standard groups
- [ ] `rule_categories` seeded with 5 categories matching wireframe tabs
- [ ] RLS enabled on all tables with correct policies (org isolation verified)
- [ ] `template_assignments` RLS scoped through org_id, admin-only writes
- [ ] `seed_template()` function creates correct mcc_groups, mcc_rules, and entity_rules rows
- [ ] Migration runs cleanly on fresh Supabase Labs instance
- [ ] Existing Cycle 1 tables (orgs, profiles, feature_flags) unaffected

### Data contract
Input: SQL migration file
Output: 8 Supabase tables with RLS, 1 database function, seed data for mcc_reference and rule_categories

### Do NOT
- Do not build any API routes — that's the next ticket
- Do not build any UI — that's tickets 3-4, 6-7
- Do not modify existing Cycle 1 tables (orgs, profiles, feature_flags)
- Do not add audit logging or versioning — deferred to future cycle

### Reference
- Spec: specs/platform-rules-engine.md, Data Model section
- Wireframes: specs/wireframes/ (all 5 screens)
- Related tickets: None
- Dependencies: GRA-24 (Supabase Labs instance must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments in the migration file
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): create rules engine schema (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 2 of 10

Title: [Shell] Implement check-mcc API — Lightweight MCC allow/block endpoint for Scout

Labels: module:shell, type:feature, priority:p0

### Context
Scout needs to check whether an estimated MCC is allowed by the rep's ISO before recommending a walk-in. This is the hot-path endpoint — called on every Scout lookup. It must be fast, cacheable, and lightweight. Shipping this immediately unblocks Scout development.

### What to build
Create a Next.js API route at `GET /api/rules/check-mcc` that accepts query parameters and returns whether an MCC code is allowed across the org's active risk templates.

**Query parameters:**
- `org_id` (required, UUID)
- `mcc_code` (required, number 0001-9999)
- `template_id` (optional, UUID — if provided, check only this template; if omitted, check all active templates)
- `include_metadata` (optional, boolean — if true, include risk_metadata in response)

**Logic:**
1. Validate inputs (return 400 for missing org_id or mcc_code, invalid MCC range)
2. Query `mcc_rules` joined with `mcc_groups` for the org's active templates
3. An MCC is blocked if: the `mcc_groups` row containing its range has `is_allowed = false` OR the specific `mcc_rules` row has `is_allowed = false`
4. If checking multiple templates, aggregate: return `is_allowed: true` only if allowed by ALL active templates. Include `blocked_by` array listing each template that blocks it.
5. If `include_metadata` is true, include `risk_metadata` from the `mcc_rules` row

**Response shape:**
```typescript
interface CheckMccResponse {
  is_allowed: boolean;
  mcc_code: number;
  mcc_description: string;       // From mcc_reference
  blocked_by?: {
    template_name: string;
    template_id: string;
    reason: 'group_blocked' | 'code_blocked';
    group_name?: string;
  }[];
  risk_metadata?: {
    est_refund_pct: number | null;
    est_chargeback_pct: number | null;
    risk_rating: string | null;
  };
}
```

**Auth:** Require Clerk auth. Verify the requesting user belongs to the org_id via profiles table.

**Performance:** Use a single SQL query with JOINs — no N+1. The `idx_mcc_rules_lookup` index should cover the hot path.

### Acceptance criteria
- [ ] `GET /api/rules/check-mcc?org_id=X&mcc_code=5993` returns correct is_allowed status
- [ ] Returns 400 for missing org_id, missing mcc_code, or invalid MCC range
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 403 if user doesn't belong to the specified org
- [ ] When no template_id specified, checks ALL active templates for the org
- [ ] When template_id specified, checks only that template
- [ ] `blocked_by` array correctly identifies which template(s) blocked and why (group vs code)
- [ ] `mcc_description` populated from mcc_reference table
- [ ] `risk_metadata` only included when `include_metadata=true`
- [ ] Response time < 100ms for single MCC lookup (single query, indexed)

### Data contract
Input: Query params `{ org_id: string, mcc_code: number, template_id?: string, include_metadata?: boolean }`
Output: `CheckMccResponse` as defined above

### Do NOT
- Do not implement the full `evaluate` endpoint — that's ticket 5
- Do not build any UI — Scout's integration is ticket 8
- Do not add caching layer — HTTP caching via GET is sufficient for beta
- Do not check entity rules, range rules, or compute risk scores — this endpoint is MCC only

### Reference
- Spec: specs/platform-rules-engine.md, API Layer section (GET /api/rules/check-mcc)
- Related tickets: None
- Dependencies: GRA-XX (ticket 1, schema must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): implement check-mcc API (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 3 of 10

Title: [Shell] Build admin UI — Risk template list with CRUD and active toggles

Labels: module:shared-ui, type:feature, priority:p1

### Context
ISO admins need to create, view, and manage their risk templates. This is the entry point to the rules engine admin UI — the first screen a user sees. Maps directly to the Visily wireframe "Your Risk Templates" screen (specs/wireframes/visily-rule-templates-1.png).

### What to build
Create a page at `/app/settings/risk-templates/page.tsx` that displays the org's risk templates in a table with CRUD operations.

**Page layout:**
- Breadcrumb: `Settings / Risk Templates`
- "New Template" button (top right, primary CTA style per design-system.md)
- Table columns: Allow (toggle), Template Name, Last Updated, See Details (→ View link)
- Empty state: "No risk templates yet. Create one to define your MCC and entity rules."

**Functionality:**
- Fetch templates via `GET /api/rules/templates` (create this API route — returns all templates for the user's org, ordered by name)
- Toggle `is_active` via `PUT /api/rules/templates/:id` with `{ is_active: boolean }`
- "New Template" opens a modal with name input, calls `POST /api/rules/templates` with `{ name: string }`. On success, call `seed_template()` DB function to populate defaults, then navigate to the detail page.
- "View" navigates to `/app/settings/risk-templates/[id]`
- Delete via context menu or row action (with confirmation modal)

**Auth/RBAC:** Page only accessible to `iso_admin` and `labs_admin` roles. Use Clerk middleware to gate access.

**Styling:** Follow design-system.md exactly — white card on gray background, table with header row, bottom-border rows, toggle switches matching production app style.

### Acceptance criteria
- [ ] Page renders at `/app/settings/risk-templates` with correct breadcrumb
- [ ] Table displays all templates for the current user's org
- [ ] Allow toggle updates `is_active` and persists immediately
- [ ] "New Template" creates a template with seeded MCC groups/codes and entity rules
- [ ] "View" navigates to detail page
- [ ] Delete removes template (with cascade to child tables) after confirmation
- [ ] Page is gated to iso_admin and labs_admin roles only
- [ ] Empty state displayed when no templates exist
- [ ] Styling matches production Gratify app per design-system.md

### Data contract
Input: Clerk auth context (org_id from user's profile)
Output: Rendered page with template list

### Do NOT
- Do not build the template detail page (MCC rules, entity rules) — that's tickets 4 and 6
- Do not implement the `evaluate` or `check-mcc` API on this page — admin UI only
- Do not add drag-to-reorder, bulk operations, or import/export

### Reference
- Spec: specs/platform-rules-engine.md, Admin UI Location section
- Wireframe: specs/wireframes/visily-rule-templates-1.png
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 1, schema), GRA-XX (ticket 2, API routes)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): risk template list page (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 4 of 10

Title: [Shell] Build admin UI — MCC group and code management with allow/block toggles

Labels: module:shared-ui, type:feature, priority:p1

### Context
ISO admins need to control which MCC codes their org will board. This is the core of the rules engine — the screen where an admin says "we don't touch CBD" or "block all gambling." Maps to Visily wireframes screens 2 (MCC groups) and 3 (MCC detail drill-down).

### What to build
Create a page section at `/app/settings/risk-templates/[id]/page.tsx` that displays MCC groups and individual codes with allow/block toggles.

**Template detail page layout:**
- Breadcrumb: `Settings / Risk Templates / [Template Name]`
- Template name + last edited info in header card with Save button
- Tab row: Entity, Financial, Directors, Business Model, Compliance (from rule_categories)
- Sub-tab row: MCC Rules | Entity Rules
- Default view: MCC Rules tab under Entity category

**MCC Groups view (wireframe screen 2):**
- Table columns: Allow (toggle), MCC Group Name, MCC Range, All Codes (→ "Edit Codes" link)
- Groups fetched from `mcc_groups` for this template
- Allow toggle updates `mcc_groups.is_allowed` via `PUT /api/rules/templates/:id/mcc-groups/:groupId`
- "Edit Codes" expands or navigates to the detail view

**MCC Detail view (wireframe screen 3):**
- Breadcrumb updates: `... / Retail Outlet Services 5000-5599`
- Table columns: Allow (toggle), MCC, Description, Est. Refund %, Est. Chargeback %, Risk Rating
- Individual code toggles update `mcc_rules.is_allowed` via `PUT /api/rules/templates/:id/mcc/:code`
- Back button returns to group view

**API routes to create:**
- `GET /api/rules/templates/:id/mcc` — returns all groups with nested codes for this template
- `PUT /api/rules/templates/:id/mcc-groups/:groupId` — toggle group allow
- `PUT /api/rules/templates/:id/mcc/:code` — toggle individual code allow, update est_refund_pct, est_chargeback_pct, risk_rating

All API routes verify user belongs to the template's org and has admin role.

### Acceptance criteria
- [ ] MCC groups display with correct names, ranges, and allow toggles
- [ ] Toggling a group off visually indicates all codes in that range are blocked
- [ ] "Edit Codes" shows individual MCC codes within the selected group
- [ ] Individual code toggles work independently of group toggle
- [ ] Est. Refund %, Est. Chargeback %, and Risk Rating display correctly from data
- [ ] Back navigation returns to group view
- [ ] All changes persist to Supabase immediately
- [ ] Tab row renders all 5 categories from rule_categories
- [ ] Styling matches wireframe and design-system.md

### Data contract
Input: Template ID from URL params, Clerk auth context
Output: Rendered MCC management UI with real-time toggle persistence

### Do NOT
- Do not build the Entity Rules sub-tab — that's ticket 6
- Do not implement search/filter on MCC codes (future enhancement)
- Do not add bulk toggle operations (toggle all in group is handled by the group toggle)
- Do not modify the `mcc_reference` table — it's read-only seed data

### Reference
- Spec: specs/platform-rules-engine.md, Data Model (mcc_groups, mcc_rules)
- Wireframes: specs/wireframes/visily-entity-rules-mcc-groups-1.png, visily-entity-rules-mcc-detail-1.png
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 1, schema), GRA-XX (ticket 3, template list page)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): MCC rules admin UI (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 5 of 10

Title: [Shell] Implement evaluate API — Full rule evaluation endpoint for SmartMPA

Labels: module:shell, type:feature, priority:p1

### Context
SmartMPA needs to evaluate a merchant application against the full rule set to produce a thumbs up / thumbs down / review decision. This is the heavy-weight counterpart to `check-mcc` — it evaluates MCC rules, entity rules, and range-based scoring to produce a risk score and decision.

### What to build
Create a Next.js API route at `POST /api/rules/evaluate` that accepts merchant data and returns a structured evaluation result.

**Request body:**
```typescript
interface EvaluateRequest {
  org_id: string;
  template_id: string;
  merchant_data: Record<string, any>;  // Keys match entity_rules.field_key values
}
```

**Evaluation logic:**
1. Validate inputs (400 for missing org_id, template_id, or empty merchant_data)
2. Auth check: user belongs to org, template belongs to org
3. Run MCC check: look up `merchant_data.mcc_code` against template's mcc_rules/mcc_groups. If blocked, set `mcc_check.is_allowed = false`
4. Run entity rules evaluation:
   - For each `entity_rules` row in this template:
     - Check if `merchant_data[field_key]` is provided
     - If required and missing: status = 'missing', risk_contribution = risk_weight (full penalty)
     - If provided: status = 'pass', risk_contribution = 0
     - If field has `has_range_rules = true` and value is provided: look up value in `range_rules`, use the matching range's risk_weight as risk_contribution
   - Sum all risk_contributions → `total_risk_score`
   - Calculate `max_possible_score` as sum of all risk_weights
5. Determine decision:
   - If `mcc_check.is_allowed = false`: decision = 'fail' (MCC knockout overrides score)
   - Else if `total_risk_score > template.fail_above`: decision = 'fail'
   - Else if `total_risk_score > template.review_above`: decision = 'review'
   - Else: decision = 'pass'
6. Collect flags array (e.g., 'missing_required_field:ein', 'high_risk_mcc', 'mcc_blocked')

**Response shape:** `EvaluateResponse` as defined in spec (decision, total_risk_score, max_possible_score, mcc_check, field_results[], flags[])

### Acceptance criteria
- [ ] POST to `/api/rules/evaluate` with valid request returns correct EvaluateResponse
- [ ] MCC blocked = automatic 'fail' decision regardless of score
- [ ] Missing required fields contribute full risk_weight as penalty
- [ ] Missing optional fields contribute 0 risk
- [ ] Range-based fields use the correct range_rules risk_weight
- [ ] Decision thresholds use template's fail_above and review_above values
- [ ] Returns 400 for invalid request, 401 for unauth, 403 for wrong org
- [ ] field_results array includes every entity_rule for the template with correct status
- [ ] flags array includes descriptive flag strings for every issue found
- [ ] Range rule gaps (value falls in no range) default to max risk_weight with a flag

### Data contract
Input: `EvaluateRequest { org_id, template_id, merchant_data }`
Output: `EvaluateResponse { decision, total_risk_score, max_possible_score, mcc_check, field_results[], flags[] }`

### Do NOT
- Do not persist evaluation results to the database — the caller (SmartMPA/Onboarding) handles storage
- Do not call external APIs (sanctions, BBB) — those are SmartMPA features, not rules engine
- Do not build any UI — SmartMPA integration is ticket 9
- Do not implement audit logging — deferred to future cycle

### Reference
- Spec: specs/platform-rules-engine.md, API Layer section (POST /api/rules/evaluate)
- Related tickets: None
- Dependencies: GRA-XX (ticket 1, schema)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shell): implement evaluate API (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 6 of 10

Title: [Shell] Build admin UI — Entity rules with required/override/risk-weight controls

Labels: module:shared-ui, type:feature, priority:p1

### Context
ISO admins need to configure which data points are required on a merchant application, what the override policy is, and how much risk weight each field carries. This is the "Entity Rules" sub-tab on the template detail page. Maps to Visily wireframe screen 4.

### What to build
Add the "Entity Rules" sub-tab to the template detail page at `/app/settings/risk-templates/[id]/page.tsx`. When the user clicks the "Entity Rules" sub-tab (next to "MCC Rules"), render the entity rules table.

**Entity Rules table (wireframe screen 4):**
- Table columns: Required (toggle), Data Point (display_name), Override (dropdown: Allowed / With Approval / Not Allowed), Risk Weight (editable number with edit icon), gear icon for fields with has_range_rules = true
- Rows fetched from `entity_rules` for this template, filtered by the active category tab (Entity, Financial, Directors, etc.)
- Category tabs filter which field_keys are shown (map field_keys to categories in the seed data)

**Functionality:**
- Required toggle updates `entity_rules.is_required` via `PUT /api/rules/templates/:id/entity-rules/:field`
- Override dropdown updates `entity_rules.override_policy`
- Risk Weight is editable inline (click edit icon → input → save)
- Gear icon on range-enabled fields (years_in_business, annual_volume, etc.) opens the range editor modal (ticket 7)

**API routes to create:**
- `GET /api/rules/templates/:id/entity-rules?category=entity` — returns entity rules filtered by category
- `PUT /api/rules/templates/:id/entity-rules/:field` — updates is_required, override_policy, risk_weight

### Acceptance criteria
- [ ] Entity Rules sub-tab renders when clicked, replacing MCC Rules view
- [ ] Table shows all entity_rules for the selected category tab
- [ ] Required toggle persists immediately
- [ ] Override dropdown shows all 3 options and persists on change
- [ ] Risk Weight is editable inline and persists on save
- [ ] Gear icon appears only on fields with has_range_rules = true
- [ ] Category tabs correctly filter the displayed fields
- [ ] Styling matches wireframe and design-system.md

### Data contract
Input: Template ID, category slug from tab selection
Output: Rendered entity rules table with inline editing

### Do NOT
- Do not build the range editor modal — that's ticket 7
- Do not add new field_keys beyond the canonical registry — add to schema CHECK constraint first
- Do not implement field validation logic — that's the evaluate API (ticket 5)
- Do not add drag-to-reorder for fields

### Reference
- Spec: specs/platform-rules-engine.md, Data Model (entity_rules)
- Wireframe: specs/wireframes/visily-entity-rules-per-field-rule-1.png
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 1, schema), GRA-XX (ticket 4, template detail page structure)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): entity rules admin UI (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 7 of 10

Title: [Shell] Build admin UI — Range editor modal with gap and overlap detection

Labels: module:shared-ui, type:feature, priority:p1

### Context
Some entity rules (like "Years in Business") need range-based risk scoring — a merchant with 0-1 years in business is higher risk than one with 5+ years. The range editor modal lets admins define these ranges with corresponding risk weights. Maps to Visily wireframe screen 5.

### What to build
Create a modal component that opens when an admin clicks the gear icon on a range-enabled entity rule (from ticket 6).

**Modal layout (wireframe screen 5):**
- Title: field display_name (e.g., "Years in Business")
- "Use Default" button (resets to seed defaults)
- Table columns: From (number input), To (number input), Risk Weight (number input), Action (+/trash icons)
- Add row button (+) appends a new empty range row
- Delete button (trash icon) removes a range row
- Validation warnings displayed below the table
- Cancel / Save buttons

**Validation (run on every change, display inline):**
1. **Gap detection:** If range_end of row N does not equal range_start of row N+1, display "⚠️ There is a gap in the range" with the gap highlighted
2. **Overlap detection:** If any two ranges overlap, display "⚠️ Ranges overlap" with the overlapping rows highlighted
3. **Save blocked** if any gaps or overlaps exist — Save button disabled with tooltip explaining why

**API:**
- `GET /api/rules/templates/:id/entity-rules/:field/ranges` — fetch current ranges
- `PUT /api/rules/templates/:id/entity-rules/:field/ranges` — replace all ranges for this field (full replacement, not partial). Validate for gaps and overlaps server-side before saving. Return 422 with descriptive error if validation fails.

**"Use Default" behavior:** Reset ranges to a sensible default based on field type. For years_in_business: 0-1 (weight 10), 1-3 (weight 7), 3-5 (weight 4), 5-10 (weight 2), 10+ (weight 0). For annual_volume and monthly_volume: define appropriate defaults.

### Acceptance criteria
- [ ] Modal opens from gear icon on range-enabled entity rules
- [ ] Displays current ranges from database
- [ ] Add/remove rows works correctly
- [ ] Gap detection fires on change and displays warning with visual highlight
- [ ] Overlap detection fires on change and displays warning with visual highlight
- [ ] Save is disabled when gaps or overlaps exist
- [ ] Save replaces all ranges atomically (no partial saves)
- [ ] Server-side validation rejects gaps/overlaps with 422 and descriptive error
- [ ] "Use Default" resets to predefined default ranges
- [ ] Cancel closes modal without saving changes
- [ ] Styling matches wireframe and design-system.md

### Data contract
Input: entity_rule_id (from parent), existing range_rules
Output: Updated range_rules (full replacement on save)

### Do NOT
- Do not implement range evaluation logic — that's in the evaluate API (ticket 5)
- Do not add custom range types beyond numeric ranges
- Do not add undo/redo functionality
- Do not build this as a separate page — it's a modal overlay on the entity rules page

### Reference
- Spec: specs/platform-rules-engine.md, Data Model (range_rules)
- Wireframe: specs/wireframes/visily-entity-rules-range-editor-1.png
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 6, entity rules page with gear icon trigger)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): range editor modal (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 8 of 10

Title: [Shell] Wire Scout orchestrator to call check-mcc — MCC knockout in pre-screen cards

Labels: module:experiment-scout, type:feature, priority:p1

### Context
Scout currently estimates the MCC from Google Places category but doesn't check whether the rep's ISO actually boards that MCC. This ticket wires Scout's orchestrator to call the `check-mcc` API and include the result in the pre-screen card, adding a critical knockout step that saves reps from visiting merchants their ISO can't board.

### What to build
In the Scout orchestrator flow (runs after Google Places lookup and MCC estimation), add a step that calls `GET /api/rules/check-mcc` with the estimated MCC code, the user's org_id, and source context if available (source_type + source_id from the lead's referral source).

**Integration points:**
1. After MCC estimation from Google Places category, call `check-mcc` with the estimated MCC. If the lead has a known referral source (ISV partner, agent group), pass `source_type` and `source_id` so the API resolves the correct template automatically
2. If `is_allowed: false`:
   - Add to the pre-screen card: "⚠️ MCC [code] ([description]) — not boarded by [template_name(s)]"
   - Downgrade walk-in score to 🔴 Walk Past with reason "Restricted MCC"
   - Still generate the rest of the card (business info, owner lookup) for informational value
   - SMS summary line includes "❌ Restricted MCC" instead of walk-in recommendation
3. If `is_allowed: true`:
   - No change to existing card flow
   - Optionally show "✅ MCC [code] — boardable" as a confidence signal
4. If the org has no active templates (no rules configured), skip the check entirely — don't block Scout functionality for orgs that haven't set up rules yet

**Edge case:** If the user's org has multiple active templates with conflicting MCC status, show all results: "Allowed by Esquire Bank, blocked by Bank B" and downgrade to 🟡 Conditional (not full walk-past, since one acquirer could board it).

### Acceptance criteria
- [ ] Scout calls check-mcc after MCC estimation on every lookup
- [ ] Blocked MCC produces 🔴 Walk Past with "Restricted MCC" reason on the card
- [ ] Pre-screen card displays MCC code, description, and which template(s) blocked it
- [ ] SMS summary includes restriction indicator for blocked MCCs
- [ ] Allowed MCC shows positive confirmation on card
- [ ] No-templates-configured gracefully skips the check (Scout works without rules engine)
- [ ] Conflicting templates produce 🟡 Conditional with per-template status
- [ ] MCC always labelled as "estimated" per existing data integrity rules

### Data contract
Input: Estimated MCC code (from Google Places), org_id (from Clerk auth)
Output: Updated pre-screen card with MCC allow/block status

### Do NOT
- Do not add entity rules evaluation to Scout — Scout only checks MCC
- Do not add sanctions or BBB checks — those are SmartMPA (see product boundaries)
- Do not modify the check-mcc API — consume it as-is from ticket 2
- Do not change the walk-in score for allowed MCCs — only add knockout for blocked ones

### Reference
- Spec: specs/platform-rules-engine.md, "How Each Product Consumes Rules" table
- Product boundaries: Scout = walk in/walk past, NOT boardability
- Scout cowork brief: Scout/scout-cowork-brief.md (orchestrator flow, output states)
- Dependencies: GRA-XX (ticket 2, check-mcc API must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(scout): wire MCC knockout to orchestrator (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 9 of 10

Title: [Shell] Wire SmartMPA pre-screen to call evaluate — Thumbs up/down from rules engine

Labels: module:experiment-smartmpa, type:feature, priority:p2

### Context
SmartMPA's core value proposition is "send in an app, get a thumbs up or down." Currently the frontend MVP is client-side only with no backend evaluation. This ticket wires SmartMPA to call the `evaluate` API and display the result as a pass/fail/review decision with supporting detail.

### What to build
In the SmartMPA application submission flow, add a step that calls `POST /api/rules/evaluate` with the application data and displays the result.

**Integration points:**
1. When a merchant application is submitted (or when a "Pre-Screen" button is clicked), collect all available merchant_data fields from the form and call `evaluate`
2. Map SmartMPA form fields to the canonical field_key registry (legal_business_name, ein, mcc_code, years_in_business, etc.)
3. Display the evaluation result:
   - **Pass (👍):** Green card — "This merchant looks boardable. [X] of [Y] checks passed, risk score [Z]."
   - **Fail (👎):** Red card — "This merchant is not boardable." Show blocking reasons: MCC blocked, missing required fields, risk score above threshold.
   - **Review (⚠️):** Yellow card — "This merchant needs manual review." Show risk score and contributing factors.
4. Below the decision card, show the `field_results` array as a checklist: each field with its status (pass ✅ / fail ❌ / missing ⚠️ / review 🔍), risk weight, and message.
5. If the org has no active templates, show a message: "No risk templates configured. Set up risk templates in Settings to enable pre-screening."

**Template selection:** If the application has a known source (ISV partner, PayFac, agent group), pass `source_type` and `source_id` to the evaluate API for automatic template resolution. If no source context is available or the org has multiple active templates, show a template selector dropdown. Default to the org's default assignment if one exists, otherwise the first active template.

### Acceptance criteria
- [ ] SmartMPA calls evaluate API with form data on pre-screen action
- [ ] Pass/fail/review decision displays with correct color coding and message
- [ ] Field results checklist shows all evaluated fields with correct status
- [ ] MCC blocked shows as a specific blocking reason
- [ ] Missing required fields show with descriptive messages
- [ ] Risk score displayed as "X of Y" with visual indicator
- [ ] Template selector appears when org has multiple active templates
- [ ] No-templates state shows helpful message pointing to Settings
- [ ] Styling matches design-system.md (KPI card pattern for decision, data table for field results)

### Data contract
Input: SmartMPA form state (mapped to EvaluateRequest.merchant_data)
Output: Rendered evaluation result card with field-level detail

### Do NOT
- Do not persist evaluation results — that's an Onboarding concern
- Do not add sanctions or BBB checks in this ticket — those are separate SmartMPA features
- Do not modify the evaluate API — consume it as-is from ticket 5
- Do not rebuild the SmartMPA form — wire into the existing Zustand store state
- Do not implement auto-evaluation on field change — only on explicit pre-screen action

### Reference
- Spec: specs/platform-rules-engine.md, "How Each Product Consumes Rules" table
- Product boundaries: SmartMPA = thumbs up/down (boardability)
- Design system: design-system.md
- Dependencies: GRA-XX (ticket 5, evaluate API must exist), SmartMPA frontend MVP (existing)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(smartmpa): wire evaluate API to pre-screen (GRA-XX)`
4. Blocking: comment, stop, notify Ryan

---

## Ticket 10 of 10

Title: [Shared-UI] Admin UI: Template assignments (Sources tab) — Map ISV partners, PayFacs, and channels to templates

Labels: module:shared-ui, type:feature, priority:p1

### Context
An ISO or acquirer often boards through multiple channels with different rules per channel. An ISV partner for gyms should only see gym MCCs as boardable. A high-risk PayFac shouldn't board eCommerce. Template assignments solve this by mapping sources (ISV partners, PayFacs, agent groups, channels) to specific risk templates so the correct rules apply automatically — without the rep manually choosing which template to check against.

### What to build
Add a "Sources" tab to the template detail page at `/app/settings/risk-templates/[id]` (alongside the existing MCC Rules and Entity Rules tabs). This tab allows the ISO admin to assign which sources/channels use this template.

**UI layout:**
1. **Sources list** — Data table showing current assignments for this template. Columns: Source Type (badge: ISV Partner / PayFac / Agent Group / Channel / Default), Source Label, Priority, Date Added, Actions (edit, remove).
2. **Add Source button** — Opens a modal with:
   - Source Type dropdown: ISV Partner, PayFac, Agent Group, Channel, Default
   - Source ID field (text input — external reference ID, partner org UUID, or slug). Hidden for "Default" type.
   - Source Label (human-readable name, e.g. "FitTech ISV", "East Coast Team")
   - Priority field (number, higher = takes precedence)
3. **Default indicator** — If this template is assigned as the org's default, show a badge "Default Template" at the top. Only one template per org can be default — setting this one removes default from the other.
4. **Validation:**
   - Prevent duplicate assignments (same org + source_type + source_id)
   - Warn if assigning a source that's already assigned to another template: "FitTech ISV is currently assigned to [Other Template]. Reassign?"
   - Only one "default" assignment per org

**API calls:**
- `GET /api/rules/templates/:id/assignments` — list assignments for this template
- `POST /api/rules/templates/:id/assignments` — create assignment
- `PUT /api/rules/templates/:id/assignments/:assignment_id` — update (change priority, label)
- `DELETE /api/rules/templates/:id/assignments/:assignment_id` — remove

### Acceptance criteria
- [ ] Sources tab renders on template detail page with data table of current assignments
- [ ] Add Source modal creates a new template_assignment row with correct fields
- [ ] Source type renders as a styled badge matching design system
- [ ] Duplicate assignment (same source_type + source_id) is rejected with descriptive error
- [ ] Reassignment warning shows when source is already assigned to another template
- [ ] Default assignment is limited to one per org — setting a new default removes the old one
- [ ] Delete removes the assignment with confirmation dialog
- [ ] Empty state shows "No sources assigned. Add a source to automatically route merchants to this template."
- [ ] Styling matches design-system.md and existing admin UI patterns from tickets 3-4

### Data contract
Input: template_id (from URL param), template_assignments rows from Supabase
Output: CRUD operations on template_assignments table

### Do NOT
- Do not build the template resolver function — that's infrastructure within the check-mcc and evaluate APIs (tickets 2, 5)
- Do not add source creation/management UI (creating ISV partners, PayFacs as entities) — that's future scope. Source IDs are entered as free text for now.
- Do not modify the MCC Rules or Entity Rules tabs
- Do not implement automatic source detection from incoming leads — that's a Scout/SmartMPA integration concern

### Reference
- Spec: specs/platform-rules-engine.md, Template Assignments section
- Design system: design-system.md
- Related tickets: GRA-XX (ticket 3, template list must exist as the parent page)
- Dependencies: GRA-XX (ticket 1, template_assignments table must exist)

### Cursor workflow
1. Flag all issues inline with `// ISSUE:` comments
2. Classify as `[BLOCKING]` or `[NON-BLOCKING]`
3. Non-blocking: comment, finish, commit and push. Format: `feat(shared-ui): template assignments sources tab (GRA-XX)`
4. Blocking: comment, stop, notify Ryan
