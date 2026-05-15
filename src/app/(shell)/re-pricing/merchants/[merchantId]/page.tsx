import { DollarSign, Hash, Percent, Receipt, Target, TrendingUp } from "lucide-react";
import { FeeDecomposition } from "@/components/repricing/FeeDecomposition";
import { MonthlyDataTable } from "@/components/repricing/MonthlyDataTable";
import { MonthlyTrendChart } from "@/components/repricing/MonthlyTrendChart";
import { NetworkFeesTable } from "@/components/repricing/NetworkFeesTable";
import { ScenarioWorkbench } from "@/components/repricing/ScenarioWorkbench";
import { VolumeDonut } from "@/components/repricing/VolumeDonut";
import { WaterfallChart } from "@/components/repricing/WaterfallChart";
import { Badge } from "@/components/repricing/ui/Badge";
import { KPICard } from "@/components/repricing/ui/KPICard";
import { PageHeader } from "@/components/repricing/ui/PageHeader";
import {
  formatBPS,
  formatCurrency,
  formatCurrencyExact,
  formatEffRate,
  formatNumber,
} from "@/lib/repricing/formatters";
import {
  getMerchantFeeDecomp,
  getMerchantMonthly,
  getMerchantNetworkFees,
  getPartnerTargetBps,
} from "@/lib/repricing/queries";
import { assertNoSupabaseError, getRepricingSupabase } from "@/lib/repricing/supabase";
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
    getRepricingSupabase()
      .from("mv_portfolio_summary")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("merchant_id", merchantId)
      .single<PortfolioMerchant>(),
    getMerchantMonthly(merchantId),
    getMerchantFeeDecomp(merchantId),
    getMerchantNetworkFees(merchantId),
  ]);

  assertNoSupabaseError(error, `Merchant profile (${merchantId})`);
  if (!merchant) {
    throw new Error(`Merchant not found: ${merchantId}`);
  }

  const targetBps = await getPartnerTargetBps(merchant.partner_name, merchant.mcc);
  const allInEffRate = merchant.volume > 0 ? (merchant.total_fees + merchant.monthly_fees) / merchant.volume : 0;
  const nrBps = merchant.volume > 0 ? (merchant.net_revenue / merchant.volume) * 10000 : 0;
  const gapToTarget = nrBps - (targetBps ?? 0);

  return (
    <div className="space-y-5">
      <PageHeader backHref="/re-pricing/dashboard" title={merchant.merchant_name} />

      <div className="flex gap-2">
        <Badge label={merchant.partner_name} variant="info" />
        <Badge label={`MCC ${merchant.mcc ?? "N/A"}`} variant="default" />
        <Badge label={merchant.pricing_type ?? "N/A"} variant="default" />
      </div>

      <div className="grid grid-cols-6 gap-4">
        <KPICard label="Volume" value={formatCurrency(merchant.volume)} icon={DollarSign} />
        <KPICard label="Transactions" value={formatNumber(merchant.txn_count)} icon={Hash} />
        <KPICard label="Avg Ticket" value={formatCurrencyExact(merchant.avg_ticket)} icon={Receipt} />
        <KPICard label="Eff Rate" value={formatEffRate(allInEffRate)} icon={Percent} />
        <KPICard
          label="Net Revenue"
          value={formatCurrency(merchant.net_revenue)}
          valueClassName={merchant.net_revenue >= 0 ? "text-green-600" : "text-red-600"}
          icon={TrendingUp}
        />
        <KPICard
          label="NR BPS"
          value={formatBPS(nrBps)}
          valueClassName={gapToTarget >= 0 ? "text-green-600" : "text-red-600"}
          subtitle={`Gap to target: ${formatBPS(gapToTarget)}`}
          trendColor={gapToTarget >= 0 ? "green" : "red"}
          icon={Target}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <MonthlyTrendChart data={monthlyData} />
        <WaterfallChart data={monthlyData} period={12} />
      </div>

      <ScenarioWorkbench data={monthlyData} targetBps={targetBps} />
      <MonthlyDataTable data={monthlyData} />

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
