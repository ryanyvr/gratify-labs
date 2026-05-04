import { DollarSign, Hash, Percent, Receipt, TrendingUp } from "lucide-react";
import { FeeDecomposition } from "@/components/repricing/FeeDecomposition";
import { MonthlyTrendChart } from "@/components/repricing/MonthlyTrendChart";
import { NetworkFeesTable } from "@/components/repricing/NetworkFeesTable";
import { VolumeDonut } from "@/components/repricing/VolumeDonut";
import { Badge } from "@/components/repricing/ui/Badge";
import { KPICard } from "@/components/repricing/ui/KPICard";
import { PageHeader } from "@/components/repricing/ui/PageHeader";
import {
  bpsColor,
  formatBPS,
  formatCurrency,
  formatCurrencyExact,
  formatNumber,
  formatPercent,
} from "@/lib/repricing/formatters";
import { getMerchantFeeDecomp, getMerchantMonthly, getMerchantNetworkFees } from "@/lib/repricing/queries";
import { supabase } from "@/lib/repricing/supabase";
import type { PortfolioMerchant } from "@/lib/repricing/types";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export const dynamic = "force-dynamic";

interface MerchantPageProps {
  params: Promise<{ merchantId: string }>;
}

export default async function RePricingMerchantPage({ params }: MerchantPageProps) {
  const { merchantId: encodedMerchantId } = await params;
  const merchantId = decodeURIComponent(encodedMerchantId);

  const [{ data: merchant, error }, monthlyData, feeData, networkFees] = await Promise.all([
    supabase
      .from("mv_portfolio_summary")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("merchant_id", merchantId)
      .single<PortfolioMerchant>(),
    getMerchantMonthly(merchantId),
    getMerchantFeeDecomp(merchantId),
    getMerchantNetworkFees(merchantId),
  ]);

  if (error || !merchant) {
    throw error ?? new Error("Merchant not found");
  }

  return (
    <div className="space-y-5">
      <PageHeader backHref="/re-pricing/dashboard" title={merchant.merchant_name} />

      <div className="flex gap-2">
        <Badge label={merchant.partner_name} variant="info" />
        <Badge label={`MCC ${merchant.mcc ?? "N/A"}`} variant="default" />
        <Badge label={merchant.pricing_type ?? "N/A"} variant="default" />
      </div>

      <div className="grid grid-cols-5 gap-4">
        <KPICard label="Volume" value={formatCurrency(merchant.volume)} icon={DollarSign} />
        <KPICard label="Transactions" value={formatNumber(merchant.txn_count)} icon={Hash} />
        <KPICard label="Avg Ticket" value={formatCurrencyExact(merchant.avg_ticket)} icon={Receipt} />
        <KPICard
          label="Markup"
          value={formatBPS(merchant.markup_bps)}
          valueClassName={bpsColor(merchant.markup_bps)}
          icon={TrendingUp}
        />
        <KPICard label="Eff Rate" value={formatPercent(merchant.eff_rate_pct)} icon={Percent} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <MonthlyTrendChart data={monthlyData} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <FeeDecomposition data={feeData} />
        </div>
        <VolumeDonut data={monthlyData} />
      </div>

      <NetworkFeesTable data={networkFees} />
    </div>
  );
}
