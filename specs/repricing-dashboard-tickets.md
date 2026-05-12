# Re-Pricing Dashboard — Build Tickets

**Context:** These tickets build a prospect demo dashboard for Re-Pricing portfolio health. Execute in order. Each ticket depends on the one before it. The full build spec with design tokens, queries, and TypeScript interfaces is at `specs/repricing-dashboard-build.md` — read that file first for context.

**Deadline:** May 5, 2026
**Org ID (hardcoded for demo):** `00000000-0000-0000-0000-000000000001`

---

## Ticket 1 of 6: Scaffold project + auth + layout

Labels: module:experiment-repricing, type:infra, priority:p0

### Context
This sets up the project skeleton with Clerk auth and the sidebar layout. Nothing renders data yet — just the shell that everything else drops into.

### What to build

1. Create a new Next.js 15 app at `/repricing` in the Gratify Labs workspace:
   ```bash
   npx create-next-app@latest repricing --typescript --tailwind --app --src-dir
   ```

2. Install dependencies:
   ```bash
   npm install @supabase/supabase-js @clerk/nextjs lucide-react recharts clsx
   ```

3. Create `.env.local` with placeholder keys (Ryan fills in real values):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://hxvigujmjftujajrigqv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_ME
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=REPLACE_ME
   CLERK_SECRET_KEY=REPLACE_ME
   ```

4. Create `src/middleware.ts` — Clerk auth middleware protecting all routes except `/sign-in` and `/sign-up`. See build spec for exact code.

5. Create sign-in and sign-up pages:
   - `src/app/sign-in/[[...sign-in]]/page.tsx` — renders `<SignIn />`
   - `src/app/sign-up/[[...sign-up]]/page.tsx` — renders `<SignUp />`

6. Create `src/app/layout.tsx`:
   - Wrap with `<ClerkProvider>`
   - Load Inter font via `next/font/google`
   - Body background: `bg-[#F5F5F7]`
   - Include a `<Sidebar />` component (fixed left, 260px) and main content area (fluid right)

7. Create `src/components/Sidebar.tsx`:
   - Gratify logo placeholder at top (text "GRATIFY" in bold, or use a simple SVG)
   - Nav sections matching the design system:
     - **Insights** section header
     - Portfolio link (active state: `bg-[#EDE9FE] text-[#5B21B6]`)
   - Lucide icons for each nav item (BarChart3 for Portfolio)
   - Org name "Prospect Demo" at bottom
   - Sidebar only renders when user is signed in (use Clerk's `useAuth()`)

8. Update `tailwind.config.ts` to extend the color palette with design tokens from the build spec.

9. Create `src/app/globals.css` with Tailwind directives.

10. Create `src/app/page.tsx` that redirects to `/dashboard`.

### Acceptance criteria
- [ ] `npm run dev` starts without errors
- [ ] Visiting `/` redirects to Clerk sign-in if not authenticated
- [ ] After sign-in, user sees sidebar + empty content area
- [ ] Sidebar shows Gratify branding and Portfolio nav item with active state
- [ ] All design tokens from the build spec are available as Tailwind classes

### Do NOT
- Do not fetch any data from Supabase yet
- Do not build any dashboard components
- Do not add mobile responsive breakpoints
- Do not add dark mode

---

## Ticket 2 of 6: Supabase client + queries + types + formatters

Labels: module:experiment-repricing, type:feature, priority:p0

### Context
This creates the data layer. All queries target the materialized views that are already populated in Supabase. After this ticket, every page can import query functions and types.

### What to build

1. Create `src/lib/supabase.ts` — Supabase client using env vars. See build spec.

2. Create `src/lib/types.ts` — All TypeScript interfaces exactly as defined in the build spec:
   - `PortfolioMerchant`
   - `PartnerSummary`
   - `MonthlySummary`
   - `FeeDecomposition`
   - `NetworkFeeSummary`

3. Create `src/lib/queries.ts` — All 6 query functions exactly as defined in the build spec:
   - `getPortfolioSummary()` — from `mv_portfolio_summary`
   - `getPartnerSummary()` — from `mv_partner_summary`
   - `getMerchantMonthly(merchantId)` — from `mv_monthly_summary`
   - `getMerchantFeeDecomp(merchantId)` — from `mv_fee_decomposition`
   - `getMerchantNetworkFees(merchantId)` — from `mv_network_fee_summary`
   - `getPartnerMerchants(partnerName)` — from `mv_portfolio_summary` filtered by partner

   All queries filter by `org_id = '00000000-0000-0000-0000-000000000001'`.

4. Create `src/lib/formatters.ts` — All formatter functions exactly as defined in the build spec:
   - `formatCurrency(value)` — $XXX,XXX (no decimals)
   - `formatCurrencyExact(value)` — $XX.XX (2 decimals)
   - `formatBPS(value)` — XX.X BPS
   - `formatPercent(value)` — X.XX% (input is ratio like 0.0175)
   - `formatNumber(value)` — X,XXX
   - `bpsColor(bps, target?)` — returns Tailwind text color class
   - `bpsBgColor(bps, target?)` — returns Tailwind bg+text color classes

### Acceptance criteria
- [ ] All 5 TypeScript interfaces compile without errors
- [ ] All 6 query functions are exported and typed
- [ ] `formatCurrency(150000)` returns `"$150,000"`
- [ ] `formatBPS(42.5)` returns `"42.5 BPS"`
- [ ] `formatPercent(0.0175)` returns `"1.75%"`
- [ ] `bpsColor(50)` returns green class, `bpsColor(70)` returns amber, `bpsColor(90)` returns red

### Do NOT
- Do not create any React components
- Do not render anything on a page
- Do not add error handling UI (just throw on error for now)

---

## Ticket 3 of 6: Shared UI components

Labels: module:experiment-repricing, type:feature, priority:p0

### Context
These are the reusable building blocks that every page uses. Build them isolated, then the page tickets just compose them.

### What to build

1. `src/components/ui/KPICard.tsx`:
   - Props: `label`, `value` (string), `subtitle?`, `icon` (LucideIcon), `trend?` ('up'|'down'|'neutral'), `trendColor?` ('green'|'red'|'amber')
   - White card (`bg-white`), 8px radius, subtle border (`border border-[#E5E7EB]`)
   - Icon top-left, muted color (`text-[#9CA3AF]`), 20px
   - Label: 13px, medium weight, `text-[#6B7280]`
   - Value: 32px, bold, `text-[#1A1A2E]`
   - Subtitle: 12px, regular, color based on `trendColor` prop
   - If `trend` is 'up', show ↑ arrow; 'down' show ↓ arrow

2. `src/components/ui/DataTable.tsx`:
   - Generic typed component: `DataTable<T>`
   - Props: `columns` array (each with `key`, `label`, `format?` function, `align?`), `data` array, `onRowClick?` callback
   - White card container with title-less header
   - Header row: `bg-[#F9FAFB]`, 13px semibold text
   - Data rows: bottom border `border-b border-[#E5E7EB]`, hover `bg-[#F9FAFB]`, cursor pointer if `onRowClick` is set
   - Text: 13-14px regular
   - Right-align numeric columns (when `align: 'right'`)

3. `src/components/ui/Badge.tsx`:
   - Props: `label`, `variant` ('default'|'success'|'warning'|'danger'|'info')
   - Small pill, 11-12px medium text, rounded-full
   - Colors per variant: default=gray, success=green, warning=amber, danger=red, info=blue

4. `src/components/ui/PageHeader.tsx`:
   - Props: `title`, `subtitle?`, `backHref?`, `actions?` (ReactNode)
   - Title: 24px semibold
   - Subtitle: 14px secondary text
   - If `backHref`, show left arrow link
   - Actions slot renders right-aligned

### Acceptance criteria
- [ ] All 4 components export and render without errors
- [ ] KPICard renders icon, label, value, and optional trend indicator
- [ ] DataTable renders headers and rows with correct alignment
- [ ] DataTable calls `onRowClick` with the row data when clicked
- [ ] Badge renders all 5 variants with correct colors
- [ ] PageHeader renders back arrow when `backHref` is provided

### Do NOT
- Do not add sorting to DataTable yet (just render in the order given)
- Do not add pagination
- Do not add search/filter inputs
- Do not fetch any data inside these components (they are purely presentational)

---

## Ticket 4 of 6: Portfolio overview page

Labels: module:experiment-repricing, type:feature, priority:p0

### Context
This is the main page the prospect sees after login. It shows the full portfolio health at a glance — KPIs, partner cards, and a merchant table. This is the money shot.

### What to build

1. `src/app/dashboard/page.tsx` — Server component that fetches data and renders the page:
   - Call `getPortfolioSummary()` and `getPartnerSummary()`
   - Pass data to client components below

2. `src/components/PortfolioKPIs.tsx` — Client component:
   - Aggregate from the portfolio data array:
     - Merchant count = `data.length`
     - Total volume = `sum(volume)`
     - Avg markup BPS = `sum(markup) / sum(volume) * 10000`
     - Avg effective rate = `sum(total_fees) / sum(volume) * 100`
   - Render 4 `KPICard` components in a grid (`grid grid-cols-4 gap-5`):
     1. Active Merchants — Building2 icon
     2. Total Volume — DollarSign icon
     3. Avg Markup — TrendingUp icon, colored by `bpsColor` against 65 BPS target
     4. Avg Effective Rate — Percent icon
   - Format values using formatters

3. `src/components/PartnerCards.tsx` — Client component:
   - Render a card for each partner in a `grid grid-cols-3 gap-5` row
   - Each card: white bg, border, 8px radius
   - Shows: partner_name (bold), mcc_description subtitle, merchant_count, total_volume (formatted), actual_bps with badge
   - BPS variance badge: green if actual ≤ target, red if over. Show "+X.X BPS over target" or "X.X BPS under target"

4. `src/components/MerchantTable.tsx` — Client component:
   - Uses `DataTable` with portfolio data
   - Columns: Merchant (name), Partner, Pricing (Badge: IC+ or Flat), Volume ($), Txns, Avg Ticket ($), IC %, Markup BPS (colored), Eff Rate (%)
   - `onRowClick` navigates to `/merchants/[merchant_id]` using Next.js `useRouter`
   - **Important:** merchant_id contains dots (e.g., "Partner 1.Merchant 1") — URL-encode it with `encodeURIComponent()`

5. Wire up `src/app/dashboard/page.tsx`:
   - `<PageHeader title="Portfolio Health" subtitle="Re-Pricing Dashboard" />`
   - `<PortfolioKPIs data={portfolioData} />`
   - `<PartnerCards data={partnerData} />`
   - Section header "Merchants" with count
   - `<MerchantTable data={portfolioData} />`

### Acceptance criteria
- [ ] `/dashboard` renders 4 KPI cards with real data from Supabase
- [ ] 3 partner cards render with correct volume and BPS variance
- [ ] Merchant table shows all 12 merchants sorted by volume descending
- [ ] Clicking a merchant row navigates to `/merchants/[encoded_merchant_id]`
- [ ] Markup BPS values are color-coded (green/amber/red) relative to 65 BPS target
- [ ] All dollar amounts are formatted with commas, no cents for large values

### Do NOT
- Do not add filtering or search to the merchant table
- Do not add date range selectors
- Do not add export functionality
- Do not build the merchant detail page yet

---

## Ticket 5 of 6: Merchant detail page

Labels: module:experiment-repricing, type:feature, priority:p0

### Context
When the prospect clicks a merchant in the portfolio table, they land here. This is the deep dive — monthly trends, fee breakdown by card brand, and network fee detail. This is where the prospect sees the value of having transaction-level visibility.

### What to build

1. `src/app/merchants/[merchantId]/page.tsx` — Server component:
   - `merchantId` comes from the URL param — `decodeURIComponent()` it
   - Fetch: `getPortfolioSummary()` filtered to this merchant (or query `mv_portfolio_summary` with `.eq('merchant_id', merchantId).single()`)
   - Fetch: `getMerchantMonthly(merchantId)`
   - Fetch: `getMerchantFeeDecomp(merchantId)`
   - Fetch: `getMerchantNetworkFees(merchantId)`
   - Pass all data to client components

2. Merchant header section:
   - `<PageHeader>` with `backHref="/dashboard"`, title = merchant_name
   - Subtitle row of badges: partner_name, MCC code, pricing_type
   - KPI row (5 cards, `grid grid-cols-5 gap-4`): Volume, Txn Count, Avg Ticket, Markup BPS, Eff Rate

3. `src/components/MonthlyTrendChart.tsx` — Client component using Recharts:
   - White card container with title "Monthly Trend"
   - `<ComposedChart>` with:
     - `<Bar>` for volume (fill `#4A8FE7`, dataKey "volume")
     - `<Line>` for markup_bps (stroke `#E8573A`, dataKey "markup_bps", yAxisId right)
     - `<ReferenceLine>` at y=65 (dashed, label "Target 65 BPS", stroke `#9CA3AF`)
   - X-axis: month field, formatted nicely (e.g., "Aug '25")
   - Left Y-axis: volume (formatted as $K)
   - Right Y-axis: BPS
   - Tooltip showing all values formatted
   - Responsive container

4. `src/components/FeeDecomposition.tsx` — Client component:
   - White card with title "Fee Decomposition by Card Brand"
   - Uses `DataTable` with fee decomp data
   - Columns: Card Brand, Entry (Badge: "CP" green or "CNP" blue based on is_card_present), Volume ($), Txns, IC %, Markup ($), Total Fees ($)
   - Sort by volume descending (already sorted from query)

5. `src/components/NetworkFeesTable.tsx` — Client component:
   - White card with title "Network & Service Fees"
   - Uses `DataTable` with network fee data
   - Columns: Fee Description, Total Fee ($), Avg Rate (%), Based on Volume ($), Occurrences
   - Total row at bottom summing total_fee

6. `src/components/VolumeDonut.tsx` — Client component:
   - White card with title "Card Present vs Card Not Present"
   - Recharts `<PieChart>` with two segments: CP volume (blue) and CNP volume (green)
   - Aggregate from monthly data: sum all cp_volume, sum all cnp_volume
   - Labels showing percentage and dollar amount
   - Simple legend below

### Acceptance criteria
- [ ] `/merchants/Partner%201.Merchant%201` renders the detail page for Merchant 1
- [ ] Back arrow navigates to `/dashboard`
- [ ] 5 KPI cards show correct values for the selected merchant
- [ ] Monthly trend chart shows bars for each month with BPS line overlay
- [ ] 65 BPS target reference line is visible
- [ ] Fee decomposition table shows breakdown by Visa/MC/Amex/Discover × CP/CNP
- [ ] Network fees table shows all fee types with correct totals
- [ ] CP/CNP donut shows volume split with percentages
- [ ] Page handles URL-encoded merchant IDs correctly

### Do NOT
- Do not add date range filtering on the monthly chart
- Do not add comparison mode (vs prior period)
- Do not make the chart interactive beyond tooltip hover
- Do not add a "re-price this merchant" action button

---

## Ticket 6 of 6: Partner detail page + polish + deploy

Labels: module:experiment-repricing, type:feature, priority:p1

### Context
Final ticket. Adds the partner drill-down, polishes the UI, and gets it deployed to Vercel. This is the last thing before the prospect sees it.

### What to build

1. `src/app/partners/[partnerName]/page.tsx`:
   - Decode `partnerName` from URL
   - Fetch `getPartnerSummary()` filtered to this partner (or query with `.eq('partner_name', partnerName).single()`)
   - Fetch `getPartnerMerchants(partnerName)`
   - PageHeader with back arrow to `/dashboard`, title = partner_name
   - Subtitle: MCC description
   - KPI row (4 cards): Merchant Count, Total Volume, Actual BPS (colored), BPS Variance (colored badge)
   - Merchants table (same `MerchantTable` component, filtered to this partner)

2. Make partner cards on the portfolio page clickable → navigate to `/partners/[encoded_partner_name]`

3. Polish pass:
   - Loading states: add `loading.tsx` files in each route with skeleton cards/table placeholders
   - Error states: add `error.tsx` files with a simple "Something went wrong" message + retry button
   - Empty states: if no data, show a message instead of empty table
   - Page transitions: ensure navigation feels smooth

4. Deployment prep:
   - Create `vercel.json` if needed
   - Ensure `next.config.ts` has no issues
   - Build passes: `npm run build` succeeds with no errors
   - Environment variables documented in `.env.example`

5. Update sidebar:
   - Portfolio link → `/dashboard`
   - Add "Merchants" as a sub-item if desired
   - Active state highlights correctly based on current route using `usePathname()`

### Acceptance criteria
- [ ] `/partners/Partner%201` renders partner detail with merchant table
- [ ] Clicking a partner card on the portfolio page navigates to partner detail
- [ ] Loading states render skeleton UI while data fetches
- [ ] `npm run build` passes with zero errors
- [ ] App deploys to Vercel successfully
- [ ] Full flow works: sign in → portfolio → click merchant → detail → back → click partner → partner detail

### Do NOT
- Do not add user management or role-based access
- Do not add data editing capabilities
- Do not add export to PDF/Excel
- Do not spend time on mobile responsive layout
- Do not add analytics tracking

---

## Execution Order

```
Ticket 1 (scaffold)  →  Ticket 2 (data layer)  →  Ticket 3 (UI components)
                                                          ↓
                         Ticket 6 (partner + deploy) ← Ticket 5 (merchant detail) ← Ticket 4 (portfolio page)
```

Each ticket builds on the last. Do not skip ahead. After each ticket, run `npm run dev` and verify the acceptance criteria before moving on.
