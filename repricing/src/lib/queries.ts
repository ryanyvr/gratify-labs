import { supabase } from "./supabase";
import type {
  FeeDecomposition,
  MonthlySummary,
  NetworkFeeSummary,
  PartnerSummary,
  PortfolioMerchant,
} from "./types";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function getPortfolioSummary(): Promise<PortfolioMerchant[]> {
  const { data, error } = await supabase
    .from("mv_portfolio_summary")
    .select("*")
    .eq("org_id", ORG_ID)
    .order("volume", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PortfolioMerchant[];
}

export async function getPartnerSummary(): Promise<PartnerSummary[]> {
  const { data, error } = await supabase
    .from("mv_partner_summary")
    .select("*")
    .eq("org_id", ORG_ID)
    .order("total_volume", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PartnerSummary[];
}

export async function getMerchantMonthly(
  merchantId: string,
): Promise<MonthlySummary[]> {
  const { data, error } = await supabase
    .from("mv_monthly_summary")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("merchant_id", merchantId)
    .order("month", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MonthlySummary[];
}

export async function getMerchantFeeDecomp(
  merchantId: string,
): Promise<FeeDecomposition[]> {
  const { data, error } = await supabase
    .from("mv_fee_decomposition")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("merchant_id", merchantId)
    .order("volume", { ascending: false });

  if (error) throw error;
  return (data ?? []) as FeeDecomposition[];
}

export async function getMerchantNetworkFees(
  merchantId: string,
): Promise<NetworkFeeSummary[]> {
  const { data, error } = await supabase
    .from("mv_network_fee_summary")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("merchant_id", merchantId)
    .order("total_fee", { ascending: false });

  if (error) throw error;
  return (data ?? []) as NetworkFeeSummary[];
}

export async function getPartnerMerchants(
  partnerName: string,
): Promise<PortfolioMerchant[]> {
  const { data, error } = await supabase
    .from("mv_portfolio_summary")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("partner_name", partnerName)
    .order("volume", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PortfolioMerchant[];
}
