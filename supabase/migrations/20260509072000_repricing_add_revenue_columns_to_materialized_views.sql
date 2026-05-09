DROP MATERIALIZED VIEW IF EXISTS mv_monthly_summary CASCADE;

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
  END AS avg_ticket,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.interchange) / SUM(t.volume)
    ELSE 0
  END AS ic_pct,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.markup) / SUM(t.volume)
    ELSE 0
  END AS markup_pct,
  CASE WHEN SUM(t.volume) > 0
    THEN (SUM(t.markup) / SUM(t.volume)) * 10000
    ELSE 0
  END AS markup_bps,
  CASE WHEN SUM(t.volume) > 0
    THEN SUM(t.total_fees) / SUM(t.volume)
    ELSE 0
  END AS eff_rate_pct,
  COALESCE(mc.monthly_pci_fee, 0) + COALESCE(mc.terminal_lease_fee, 0) AS monthly_fees,
  COALESCE(nf.fee_total, 0) AS network_costs,
  (SUM(t.total_fees) + COALESCE(mc.monthly_pci_fee, 0) + COALESCE(mc.terminal_lease_fee, 0))
    - SUM(t.interchange)
    - COALESCE(nf.fee_total, 0) AS net_revenue
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

DROP MATERIALIZED VIEW IF EXISTS mv_portfolio_summary CASCADE;

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
  COALESCE(nf.total_network_fees, 0)      AS total_network_fees,
  COALESCE(nf.total_network_fees, 0)      AS network_costs,
  (SUM(t.total_fees)
    + COUNT(DISTINCT TO_CHAR(t.transaction_date, 'YYYY-MM'))
      * (COALESCE(mc.monthly_pci_fee, 0) + COALESCE(mc.terminal_lease_fee, 0)))
    - SUM(t.interchange)
    - COALESCE(nf.total_network_fees, 0)  AS net_revenue
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

SELECT refresh_repricing_views();
