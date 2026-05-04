export interface PortfolioMerchant {
  org_id: string;
  merchant_id: string;
  merchant_name: string;
  partner_name: string;
  mcc: number | null;
  pricing_type: string | null;
  txn_count: number;
  volume: number;
  interchange: number;
  markup: number;
  total_fees: number;
  avg_ticket: number;
  ic_pct: number;
  markup_pct: number;
  markup_bps: number;
  eff_rate_pct: number;
  first_txn_date: string;
  last_txn_date: string;
  months_active: number;
  total_network_fees: number;
}

export interface PartnerSummary {
  org_id: string;
  partner_name: string;
  mcc: number | null;
  mcc_description: string | null;
  target_bps: number | null;
  merchant_count: number;
  total_volume: number;
  total_markup: number;
  total_fees: number;
  actual_bps: number;
  bps_variance: number;
}

export interface MonthlySummary {
  org_id: string;
  merchant_id: string;
  merchant_name: string;
  partner_name: string;
  month: string;
  txn_count: number;
  volume: number;
  interchange: number;
  markup: number;
  total_fees: number;
  cp_volume: number;
  cnp_volume: number;
  avg_ticket: number;
  ic_pct: number;
  markup_pct: number;
  markup_bps: number;
  eff_rate_pct: number;
}

export interface FeeDecomposition {
  org_id: string;
  merchant_id: string;
  merchant_name: string;
  card_brand: string;
  is_card_present: boolean;
  txn_count: number;
  volume: number;
  interchange: number;
  markup: number;
  total_fees: number;
  ic_pct: number;
}

export interface NetworkFeeSummary {
  org_id: string;
  merchant_id: string;
  merchant_name: string;
  fee_description: string;
  total_fee: number;
  avg_rate: number | null;
  total_volume: number | null;
  occurrences: number;
}
