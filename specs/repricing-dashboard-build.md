# Re-Pricing Dashboard — Build Spec for Cursor

**Priority:** URGENT — prospect demo needed by May 5, 2026
**Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, Supabase, Clerk auth
**Data:** Already loaded in Supabase (12 merchants, 3 partners, ~110k transactions, ~4.5k network fees)
**Org ID:** `00000000-0000-0000-0000-000000000001`

---

## Project Setup

Create a new Next.js app at `/repricing` (sibling to the existing `/smartmpa` app in the Gratify Labs folder), or add as a route group to an existing Gratify One shell if one exists.

### Dependencies
```bash
npx create-next-app@latest repricing --typescript --tailwind --app --src-dir
cd repricing
npm install @supabase/supabase-js @clerk/nextjs lucide-react recharts clsx
```

### Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://hxvigujmjftujajrigqv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Ryan provides>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Ryan provides>
CLERK_SECRET_KEY=<Ryan provides>
```

### Supabase Client (`src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
```

For the prospect demo, hardcode `org_id = '00000000-0000-0000-0000-000000000001'`. In production this comes from the Clerk user's profile → org_id lookup.

---

## Design System Tokens

Match the Gratify production app (kyb.gratifypay.com):

```typescript
// tailwind.config.ts extend
colors: {
  primary: '#E8573A',
  'primary-hover': '#D14A30',
  'chart-blue': '#4A8FE7',
  'chart-green': '#22C55E',
  'chart-amber': '#F59E0B',
  'chart-red': '#EF4444',
  'bg-page': '#F5F5F7',
  'bg-card': '#FFFFFF',
  'border-card': '#E5E7EB',
  'text-primary': '#1A1A2E',
  'text-secondary': '#6B7280',
  'text-tertiary': '#9CA3AF',
}
```

Font: Inter via `next/font/google`. Body bg: `bg-[#F5F5F7]`.

---

## Pages

### 1. Portfolio Overview (`/`)

The main dashboard. Shows KPIs across all merchants, a merchant table, and partner summary.

#### KPI Row (4 cards)

Query `mv_portfolio_summary` for all merchants:

```sql
SELECT
  COUNT(DISTINCT merchant_id) AS merchant_count,
  SUM(volume) AS total_volume,
  CASE WHEN SUM(volume) > 0 THEN SUM(markup) / SUM(volume) * 10000 ELSE 0 END AS avg_markup_bps,
  CASE WHEN SUM(volume) > 0 THEN SUM(total_fees) / SUM(volume) ELSE 0 END AS avg_eff_rate
FROM mv_portfolio_summary
WHERE org_id = $ORG_ID
```

Cards:
1. **Active Merchants** — `merchant_count` (icon: Building2)
2. **Total Volume** — `$X,XXX,XXX` formatted (icon: DollarSign)
3. **Avg Markup** — `XX.X BPS` (icon: TrendingUp). Color green if < 65 BPS (target), amber if 65-80, red if > 80
4. **Avg Effective Rate** — `X.XX%` (icon: Percent)

#### Partner Summary Row (card per partner)

Query `mv_partner_summary`:

```sql
SELECT partner_name, mcc, mcc_description, target_bps,
       merchant_count, total_volume, total_markup, actual_bps, bps_variance
FROM mv_partner_summary
WHERE org_id = $ORG_ID
ORDER BY total_volume DESC
```

Each partner card shows:
- Partner name + MCC description subtitle
- Merchant count
- Total volume (formatted)
- Actual BPS vs Target BPS with colored variance badge
  - Green if actual ≤ target
  - Red if actual > target (overpaying)

#### Merchant Table

Query `mv_portfolio_summary`:

```sql
SELECT merchant_id, merchant_name, partner_name, mcc, pricing_type,
       volume, txn_count, markup, total_fees, avg_ticket,
       ic_pct, markup_pct, markup_bps, eff_rate_pct,
       months_active, total_network_fees
FROM mv_portfolio_summary
WHERE org_id = $ORG_ID
ORDER BY volume DESC
```

Table columns:
| Column | Source | Format |
|--------|--------|--------|
| Merchant | merchant_name | Text, link to detail page |
| Partner | partner_name | Text |
| Pricing | pricing_type | Badge (IC+ or Flat) |
| Volume | volume | $XXX,XXX |
| Txns | txn_count | X,XXX |
| Avg Ticket | avg_ticket | $XX.XX |
| IC % | ic_pct | X.XX% |
| Markup BPS | markup_bps | XX.X — color coded vs 65 BPS target |
| Eff Rate | eff_rate_pct | X.XX% |
| Months | months_active | X |

Each row is clickable → navigates to `/merchants/[merchant_id]`

---

### 2. Merchant Detail (`/merchants/[merchant_id]`)

Deep dive on a single merchant. Back button → portfolio.

#### Header
- Merchant name (large)
- Partner name, MCC, Pricing type as subtitle badges
- KPI row: Volume, Txn Count, Avg Ticket, Markup BPS, Eff Rate (from `mv_portfolio_summary` filtered by merchant_id)

#### Monthly Trend Chart

Query `mv_monthly_summary`:

```sql
SELECT month, volume, interchange, markup, total_fees,
       txn_count, avg_ticket, ic_pct, markup_pct, markup_bps, eff_rate_pct,
       cp_volume, cnp_volume
FROM mv_monthly_summary
WHERE org_id = $ORG_ID AND merchant_id = $MERCHANT_ID
ORDER BY month ASC
```

Recharts composed chart:
- **Bar chart**: volume per month (blue bars)
- **Line overlay**: markup_bps per month (orange line, right Y axis)
- **Dashed reference line**: 65 BPS target
- X-axis: month labels (Aug '25, Sep '25, ...)

#### Fee Decomposition Table

Query `mv_fee_decomposition`:

```sql
SELECT card_brand, is_card_present, txn_count, volume,
       interchange, markup, total_fees, ic_pct
FROM mv_fee_decomposition
WHERE org_id = $ORG_ID AND merchant_id = $MERCHANT_ID
ORDER BY volume DESC
```

Table columns:
| Column | Format |
|--------|--------|
| Card Brand | Visa, MC, Amex, Discover |
| Entry | CP or CNP badge |
| Volume | $XXX,XXX |
| Txns | X,XXX |
| IC % | X.XX% |
| Markup | $X,XXX |
| Total Fees | $X,XXX |

#### Network Fees Table

Query `mv_network_fee_summary`:

```sql
SELECT fee_description, total_fee, avg_rate, total_volume, occurrences
FROM mv_network_fee_summary
WHERE org_id = $ORG_ID AND merchant_id = $MERCHANT_ID
ORDER BY total_fee DESC
```

Table columns: Fee Description, Total Fee ($), Avg Rate (%), Based on Volume ($), Occurrences

#### CP/CNP Volume Split

Small donut or horizontal bar chart showing:
- Card Present volume vs Card Not Present volume
- From the monthly summary data (sum cp_volume, cnp_volume)

---

### 3. Partner Detail (`/partners/[partner_name]`)

Optional but valuable — shows all merchants under one partner/BU.

#### Header
- Partner name, MCC description, Target BPS
- KPI row from `mv_partner_summary`

#### Merchants under this partner
- Same table as portfolio overview but filtered to this partner
- Query `mv_portfolio_summary WHERE partner_name = $PARTNER_NAME`

---

## Shared Components (`src/components/ui/`)

### KPICard
```typescript
interface KPICardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  trendColor?: 'green' | 'red' | 'amber'
}
```
White card, 8px radius, subtle border. Icon top-left (muted), label below (13px medium secondary), large value (32px bold), optional subtitle with colored trend arrow.

### DataTable
Generic sortable table component. White card container, header row with gray bg, clean row borders, hover state. Accepts column definitions and data array.

### Badge
Small pill for status/type indicators. Variants: `default`, `success`, `warning`, `danger`.

### PageHeader
Title + subtitle + optional action button. Consistent across all pages.

### Sidebar
Fixed 260px sidebar matching design system nav structure. For the prospect demo, show:
- Gratify logo
- Dashboard (active)
- Portfolio (under Insights section)
- Merchant list link

---

## Auth (Clerk)

Wrap the app with `<ClerkProvider>`. Use `<SignIn />` and `<SignUp />` pages. Protect all routes with middleware.

For the prospect demo, create a Clerk user manually and just use email/password login. The dashboard renders the same data regardless of who logs in (single org, hardcoded org_id).

`src/middleware.ts`:
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

---

## File Structure

```
repricing/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with ClerkProvider, sidebar, Inter font
│   │   ├── page.tsx                # Portfolio overview (redirect or main page)
│   │   ├── globals.css             # Tailwind imports + custom tokens
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Portfolio overview dashboard
│   │   ├── merchants/
│   │   │   └── [merchantId]/
│   │   │       └── page.tsx        # Merchant detail
│   │   └── partners/
│   │       └── [partnerName]/
│   │           └── page.tsx        # Partner detail
│   ├── components/
│   │   ├── ui/
│   │   │   ├── KPICard.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── Sidebar.tsx
│   │   ├── PortfolioKPIs.tsx       # KPI row for portfolio page
│   │   ├── PartnerCards.tsx        # Partner summary cards
│   │   ├── MerchantTable.tsx       # Sortable merchant table
│   │   ├── MonthlyTrendChart.tsx   # Recharts bar+line combo
│   │   ├── FeeDecomposition.tsx    # Card brand × entry type table
│   │   ├── NetworkFeesTable.tsx    # Network fee summary
│   │   └── VolumeDonut.tsx         # CP/CNP split chart
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   ├── queries.ts             # All Supabase query functions
│   │   ├── types.ts               # TypeScript interfaces
│   │   └── formatters.ts          # Currency, BPS, percentage formatters
│   └── middleware.ts               # Clerk auth middleware
├── tailwind.config.ts
├── .env.local
└── package.json
```

---

## Query Functions (`src/lib/queries.ts`)

```typescript
import { supabase } from './supabase'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export async function getPortfolioSummary() {
  const { data, error } = await supabase
    .from('mv_portfolio_summary')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('volume', { ascending: false })
  if (error) throw error
  return data
}

export async function getPartnerSummary() {
  const { data, error } = await supabase
    .from('mv_partner_summary')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('total_volume', { ascending: false })
  if (error) throw error
  return data
}

export async function getMerchantMonthly(merchantId: string) {
  const { data, error } = await supabase
    .from('mv_monthly_summary')
    .select('*')
    .eq('org_id', ORG_ID)
    .eq('merchant_id', merchantId)
    .order('month', { ascending: true })
  if (error) throw error
  return data
}

export async function getMerchantFeeDecomp(merchantId: string) {
  const { data, error } = await supabase
    .from('mv_fee_decomposition')
    .select('*')
    .eq('org_id', ORG_ID)
    .eq('merchant_id', merchantId)
    .order('volume', { ascending: false })
  if (error) throw error
  return data
}

export async function getMerchantNetworkFees(merchantId: string) {
  const { data, error } = await supabase
    .from('mv_network_fee_summary')
    .select('*')
    .eq('org_id', ORG_ID)
    .eq('merchant_id', merchantId)
    .order('total_fee', { ascending: false })
  if (error) throw error
  return data
}

export async function getPartnerMerchants(partnerName: string) {
  const { data, error } = await supabase
    .from('mv_portfolio_summary')
    .select('*')
    .eq('org_id', ORG_ID)
    .eq('partner_name', partnerName)
    .order('volume', { ascending: false })
  if (error) throw error
  return data
}
```

**IMPORTANT:** Supabase treats materialized views as queryable tables. The `.from('mv_portfolio_summary')` syntax works because Supabase exposes views through PostgREST the same way as tables. No RPC calls needed.

---

## TypeScript Interfaces (`src/lib/types.ts`)

```typescript
export interface PortfolioMerchant {
  org_id: string
  merchant_id: string
  merchant_name: string
  partner_name: string
  mcc: number | null
  pricing_type: string | null
  txn_count: number
  volume: number
  interchange: number
  markup: number
  total_fees: number
  avg_ticket: number
  ic_pct: number
  markup_pct: number
  markup_bps: number
  eff_rate_pct: number
  first_txn_date: string
  last_txn_date: string
  months_active: number
  total_network_fees: number
}

export interface PartnerSummary {
  org_id: string
  partner_name: string
  mcc: number | null
  mcc_description: string | null
  target_bps: number | null
  merchant_count: number
  total_volume: number
  total_markup: number
  total_fees: number
  actual_bps: number
  bps_variance: number
}

export interface MonthlySummary {
  org_id: string
  merchant_id: string
  merchant_name: string
  partner_name: string
  month: string
  txn_count: number
  volume: number
  interchange: number
  markup: number
  total_fees: number
  cp_volume: number
  cnp_volume: number
  avg_ticket: number
  ic_pct: number
  markup_pct: number
  markup_bps: number
  eff_rate_pct: number
}

export interface FeeDecomposition {
  org_id: string
  merchant_id: string
  merchant_name: string
  card_brand: string
  is_card_present: boolean
  txn_count: number
  volume: number
  interchange: number
  markup: number
  total_fees: number
  ic_pct: number
}

export interface NetworkFeeSummary {
  org_id: string
  merchant_id: string
  merchant_name: string
  fee_description: string
  total_fee: number
  avg_rate: number | null
  total_volume: number | null
  occurrences: number
}
```

---

## Formatter Utilities (`src/lib/formatters.ts`)

```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrencyExact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatBPS(value: number): string {
  return `${value.toFixed(1)} BPS`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function bpsColor(bps: number, target: number = 65): string {
  if (bps <= target) return 'text-green-600'
  if (bps <= target * 1.2) return 'text-amber-600'
  return 'text-red-600'
}

export function bpsBgColor(bps: number, target: number = 65): string {
  if (bps <= target) return 'bg-green-100 text-green-800'
  if (bps <= target * 1.2) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}
```

---

## Data Notes

- **12 merchants** across 3 partners (Partner 1 = Liquor/5921, Partner 2 = Auto/7538, Partner 3 = Taxi/4121)
- **109,949 transactions** from Aug 2025 – Mar 2026
- **4,543 network fee** records
- All merchants are IC+ except Merchant 12 (flat rate at 3.4%)
- Markup rates range from 0.08% (Merchant 7) to 0.65% (most Partner 1 merchants)
- Target BPS is set to 65 for all partners (adjust in partner_config if needed)
- Merchant IDs use format "Partner X.Merchant Y" — URL-encode in routes

---

## Do NOT Build

- No data upload/import UI — data is pre-loaded
- No user management or org switching — single org demo
- No editing of merchant config or partner config — read-only dashboard
- No real-time data — materialized views refreshed manually
- No mobile responsive — desktop-first for this demo
- No dark mode
