-- ============================================================
-- Gratify One — Re-Pricing Schema (Supabase)
-- Run in Supabase SQL Editor in order (top to bottom)
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Partner / Business Unit configuration
-- Configured by Gratify analyst or ISO ops during setup
CREATE TABLE partner_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  partner_name      TEXT NOT NULL,
  mcc               INT,
  mcc_description   TEXT,
  target_bps        INT,                                -- Target markup in basis points
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(org_id, partner_name)
);

-- Merchant configuration — pricing type and per-brand markup rates
CREATE TABLE merchant_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES orgs(id),
  merchant_id           TEXT NOT NULL,                   -- External merchant identifier (join key)
  merchant_name         TEXT NOT NULL,
  partner_name          TEXT NOT NULL,                   -- FK to partner_config.partner_name (logical)
  mcc                   INT NOT NULL,
  pricing_type          TEXT NOT NULL CHECK (pricing_type IN ('IC_PLUS', 'FLAT_RATE', 'TIERED')),
  cp_visa_markup_pct    NUMERIC(6,4),
  cnp_visa_markup_pct   NUMERIC(6,4),
  cp_mc_markup_pct      NUMERIC(6,4),
  cnp_mc_markup_pct     NUMERIC(6,4),
  cp_amex_markup_pct    NUMERIC(6,4),
  cnp_amex_markup_pct   NUMERIC(6,4),
  cp_debit_markup_pct   NUMERIC(6,4),
  cnp_debit_markup_pct  NUMERIC(6,4),
  flat_rate_pct         NUMERIC(6,4),                   -- Blended rate (FLAT_RATE only)
  monthly_pci_fee       NUMERIC(8,2),
  terminal_lease_fee    NUMERIC(8,2),
  chargeback_fee        NUMERIC(8,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(org_id, merchant_id)
);

-- Transaction-level data (the core dataset)
-- Loaded via CSV import or API feed
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  merchant_id       TEXT NOT NULL,                       -- Join key to merchant_config
  merchant_name     TEXT NOT NULL,
  partner_name      TEXT NOT NULL,
  transaction_date  DATE NOT NULL,
  volume            NUMERIC(12,2) NOT NULL CHECK (volume > 0),
  interchange       NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (interchange >= 0),
  markup            NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (markup >= 0),
  total_fees        NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (total_fees >= 0),
  card_brand        TEXT NOT NULL CHECK (card_brand IN ('Visa', 'Mastercard', 'Amex', 'Discover')),
  is_card_present   BOOLEAN NOT NULL,
  is_settled        BOOLEAN NOT NULL DEFAULT true,
  mcc               INT,
  is_international  BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Network fees (PCI, terminal, assessments, etc.)
CREATE TABLE network_fees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  merchant_id       TEXT NOT NULL,
  merchant_name     TEXT NOT NULL,
  fee_description   TEXT NOT NULL,
  fee_month         TEXT NOT NULL,                       -- YYYY-MM format
  fee_amount        NUMERIC(10,4) NOT NULL,
  based_on_rate     NUMERIC(6,4),
  based_on_volume   NUMERIC(12,2),
  based_on_count    INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 2. INDEXES (optimized for dashboard queries)
-- ============================================================

-- Transactions: monthly aggregation by merchant
CREATE INDEX idx_txn_org_merchant_date
  ON transactions(org_id, merchant_id, transaction_date);

-- Transactions: partner/BU filtering
CREATE INDEX idx_txn_org_partner_date
  ON transactions(org_id, partner_name, transaction_date);

-- Transactions: settled-only filter (most queries filter on this)
CREATE INDEX idx_txn_settled
  ON transactions(org_id, is_settled, transaction_date);

-- Merchant config: lookup by org
CREATE INDEX idx_merchant_config_org
  ON merchant_config(org_id, partner_name);

-- Network fees: monthly aggregation
CREATE INDEX idx_network_fees_org_merchant
  ON network_fees(org_id, merchant_id, fee_month);


-- ============================================================
-- 3. MATERIALIZED VIEWS (pre-computed for dashboard speed)
-- ============================================================

-- Monthly summary per merchant (the main dashboard grain)
CREATE MATERIALIZED VIEW mv_monthly_summary AS
SELECT
  t.org_id,
  t.merchant_id,
  t.merchant_name,
  t.partner_name,
  TO_CHAR(t.transaction_date, 'YYYY-MM') AS month,
  COUNT(*)                                AS txn_count,
  SUM(t.volume)                           AS volume,
  SUM(t.interchange)                      AS interchange,
  SUM(t.markup)                           AS markup,
  SUM(t.total_fees)                       AS total_fees,
  SUM(CASE WHEN t.is_card_present THEN t.volume ELSE 0 END) AS cp_volume,
  SUM(CASE WHEN NOT t.is_card_present THEN t.volume ELSE 0 END) AS cnp_volume,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.volume) / COUNT(*)
    ELSE 0
  END                                     AS avg_ticket,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.interchange) / SUM(t.volume)
    ELSE 0
  END                                     AS ic_pct,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.markup) / SUM(t.volume)
    ELSE 0
  END                                     AS markup_pct,
  CASE WHEN SUM(t.volume) > 0
    THEN (SUM(t.markup) / SUM(t.volume)) * 10000
    ELSE 0
  END                                     AS markup_bps,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.total_fees) / SUM(t.volume)
    ELSE 0
  END                                     AS eff_rate_pct,
  COALESCE(mc.monthly_pci_fee, 0) + COALESCE(mc.terminal_lease_fee, 0) AS monthly_fees,
  COALESCE(nf.fee_total, 0)               AS network_costs,
  (SUM(t.total_fees) + COALESCE(mc.monthly_pci_fee, 0) + COALESCE(mc.terminal_lease_fee, 0))
    - SUM(t.interchange)
    - COALESCE(nf.fee_total, 0)           AS net_revenue
FROM transactions t
LEFT JOIN merchant_config mc
  ON mc.org_id = t.org_id AND mc.merchant_id = t.merchant_id
LEFT JOIN (
  SELECT org_id, merchant_id, fee_month, SUM(fee_amount) AS fee_total
  FROM network_fees
  GROUP BY org_id, merchant_id, fee_month
) nf ON nf.org_id = t.org_id
     AND nf.merchant_id = t.merchant_id
     AND nf.fee_month = TO_CHAR(t.transaction_date, 'YYYY-MM')
WHERE t.is_settled = true
GROUP BY t.org_id, t.merchant_id, t.merchant_name, t.partner_name,
         TO_CHAR(t.transaction_date, 'YYYY-MM'),
         mc.monthly_pci_fee, mc.terminal_lease_fee, nf.fee_total;

CREATE UNIQUE INDEX idx_mv_monthly_summary
  ON mv_monthly_summary(org_id, merchant_id, month);

-- Portfolio summary per merchant (all-time or latest 12 months)
CREATE MATERIALIZED VIEW mv_portfolio_summary AS
SELECT
  t.org_id,
  t.merchant_id,
  t.merchant_name,
  t.partner_name,
  mc.mcc,
  mc.pricing_type,
  COUNT(*)                                AS txn_count,
  SUM(t.volume)                           AS volume,
  SUM(t.interchange)                      AS interchange,
  SUM(t.markup)                           AS markup,
  SUM(t.total_fees)                       AS total_fees,
  CASE WHEN COUNT(*) > 0
    THEN SUM(t.volume) / COUNT(*)
    ELSE 0
  END                                     AS avg_ticket,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.interchange) / SUM(t.volume)
    ELSE 0
  END                                     AS ic_pct,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.markup) / SUM(t.volume)
    ELSE 0
  END                                     AS markup_pct,
  CASE WHEN SUM(t.volume) > 0
    THEN (SUM(t.markup) / SUM(t.volume)) * 10000
    ELSE 0
  END                                     AS markup_bps,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.total_fees) / SUM(t.volume)
    ELSE 0
  END                                     AS eff_rate_pct,
  MIN(t.transaction_date)                 AS first_txn_date,
  MAX(t.transaction_date)                 AS last_txn_date,
  COUNT(DISTINCT TO_CHAR(t.transaction_date, 'YYYY-MM')) AS months_active,
  COUNT(DISTINCT TO_CHAR(t.transaction_date, 'YYYY-MM'))
    * (COALESCE(mc.monthly_pci_fee, 0) + COALESCE(mc.terminal_lease_fee, 0)) AS monthly_fees,
  COALESCE(nf.total_network_fees, 0)     AS total_network_fees,
  COALESCE(nf.total_network_fees, 0)     AS network_costs,
  (SUM(t.total_fees)
    + COUNT(DISTINCT TO_CHAR(t.transaction_date, 'YYYY-MM'))
      * (COALESCE(mc.monthly_pci_fee, 0) + COALESCE(mc.terminal_lease_fee, 0)))
    - SUM(t.interchange)
    - COALESCE(nf.total_network_fees, 0) AS net_revenue
FROM transactions t
LEFT JOIN merchant_config mc
  ON mc.org_id = t.org_id AND mc.merchant_id = t.merchant_id
LEFT JOIN (
  SELECT org_id, merchant_id, SUM(fee_amount) AS total_network_fees
  FROM network_fees
  GROUP BY org_id, merchant_id
) nf ON nf.org_id = t.org_id AND nf.merchant_id = t.merchant_id
WHERE t.is_settled = true
GROUP BY t.org_id, t.merchant_id, t.merchant_name, t.partner_name,
         mc.mcc, mc.pricing_type, mc.monthly_pci_fee, mc.terminal_lease_fee, nf.total_network_fees;

CREATE UNIQUE INDEX idx_mv_portfolio_summary
  ON mv_portfolio_summary(org_id, merchant_id);

-- Fee decomposition per merchant per card brand per entry type
CREATE MATERIALIZED VIEW mv_fee_decomposition AS
SELECT
  t.org_id,
  t.merchant_id,
  t.merchant_name,
  t.card_brand,
  t.is_card_present,
  COUNT(*)                                AS txn_count,
  SUM(t.volume)                           AS volume,
  SUM(t.interchange)                      AS interchange,
  SUM(t.markup)                           AS markup,
  SUM(t.total_fees)                       AS total_fees,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.interchange) / SUM(t.volume)
    ELSE 0
  END                                     AS ic_pct
FROM transactions t
WHERE t.is_settled = true
GROUP BY t.org_id, t.merchant_id, t.merchant_name, t.card_brand, t.is_card_present;

CREATE UNIQUE INDEX idx_mv_fee_decomp
  ON mv_fee_decomposition(org_id, merchant_id, card_brand, is_card_present);

-- Network fee summary per merchant per fee type
CREATE MATERIALIZED VIEW mv_network_fee_summary AS
SELECT
  nf.org_id,
  nf.merchant_id,
  nf.merchant_name,
  nf.fee_description,
  SUM(nf.fee_amount)                      AS total_fee,
  AVG(nf.based_on_rate)                   AS avg_rate,
  SUM(nf.based_on_volume)                 AS total_volume,
  COUNT(*)                                AS occurrences
FROM network_fees nf
GROUP BY nf.org_id, nf.merchant_id, nf.merchant_name, nf.fee_description;

CREATE UNIQUE INDEX idx_mv_network_fee_summary
  ON mv_network_fee_summary(org_id, merchant_id, fee_description);

-- Partner summary (for partner/BU filter and KPIs)
CREATE MATERIALIZED VIEW mv_partner_summary AS
SELECT
  t.org_id,
  t.partner_name,
  pc.mcc,
  pc.mcc_description,
  pc.target_bps,
  COUNT(DISTINCT t.merchant_id)           AS merchant_count,
  SUM(t.volume)                           AS total_volume,
  SUM(t.markup)                           AS total_markup,
  SUM(t.total_fees)                       AS total_fees,
  CASE WHEN SUM(t.volume) > 0
    THEN (SUM(t.markup) / SUM(t.volume)) * 10000
    ELSE 0
  END                                     AS actual_bps,
  CASE WHEN SUM(t.volume) > 0
    THEN (SUM(t.markup) / SUM(t.volume)) * 10000 - COALESCE(pc.target_bps, 0)
    ELSE 0
  END                                     AS bps_variance
FROM transactions t
LEFT JOIN partner_config pc
  ON pc.org_id = t.org_id AND pc.partner_name = t.partner_name
WHERE t.is_settled = true
GROUP BY t.org_id, t.partner_name, pc.mcc, pc.mcc_description, pc.target_bps;

CREATE UNIQUE INDEX idx_mv_partner_summary
  ON mv_partner_summary(org_id, partner_name);


-- ============================================================
-- 4. REFRESH FUNCTION (call after data loads)
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_repricing_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_portfolio_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fee_decomposition;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_network_fee_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_partner_summary;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

-- NOTE: Auth is Clerk (not Supabase Auth), so auth.uid() is not available.
-- For the MVP/prospect demo, RLS is NOT enabled on these tables.
-- Org isolation is enforced at the API route level:
--   1. Clerk authenticates the request
--   2. API looks up org_id from profiles WHERE clerk_user_id = <clerk_id>
--   3. Every query filters by org_id
--
-- Future: Wire Clerk JWTs into Supabase using Clerk's custom JWT template,
-- then enable RLS with policies that read the JWT claims.
-- See: https://clerk.com/docs/integrations/databases/supabase


-- ============================================================
-- 6. NOTES
-- ============================================================

-- After running this migration:
-- 1. Load CSV data into transactions, merchant_config, network_fees, partner_config
--    (use Supabase dashboard CSV import or the import script)
-- 2. Call: SELECT refresh_repricing_views();
--    This populates all materialized views for the dashboard
-- 3. All API routes MUST filter by org_id (no RLS safety net for now)
-- 4. Use the service_role key for data imports (bypasses any future RLS)
