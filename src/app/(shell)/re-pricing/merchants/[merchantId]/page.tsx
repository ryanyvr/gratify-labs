import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FeeDecomposition } from "@/components/repricing/FeeDecomposition";
import { MonthlyDataTable } from "@/components/repricing/MonthlyDataTable";
import { MonthlyTrendChart } from "@/components/repricing/MonthlyTrendChart";
import { NetworkFeesTable } from "@/components/repricing/NetworkFeesTable";
import { ScenarioWorkbench } from "@/components/repricing/ScenarioWorkbench";
import { VolumeDonut } from "@/components/repricing/VolumeDonut";
import { WaterfallChart } from "@/components/repricing/WaterfallChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  bpsColor,
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
import { cn } from "@/lib/utils";
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

  const targetBps = (await getPartnerTargetBps(merchant.partner_name, merchant.mcc)) ?? 62;
  const effRate =
    merchant.volume > 0 ? (merchant.total_fees + merchant.monthly_fees) / merchant.volume : 0;
  const gap = merchant.markup_bps - targetBps;
  const statusLabel = gap >= 0 ? "On Target" : gap >= -10 ? "Below Target" : "Critical";
  const statusVariant =
    gap >= 0 ? "success" : gap >= -10 ? ("warning" as const) : ("danger" as const);

  // TODO: add mcc_description to materialized view
  const mccDescription = merchant.mcc_description ?? "—";

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <CardContent className="p-0">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/re-pricing/dashboard"
                className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to portfolio
              </Link>
              <h2 className="text-xl font-extrabold text-foreground">{merchant.merchant_name}</h2>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                {merchant.partner_name} · MCC {merchant.mcc ?? "—"} ({mccDescription}) ·{" "}
                {merchant.pricing_type ?? "IC PLUS"} · {merchant.months_active ?? "—"} months
              </div>
            </div>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <div className="text-[11px] text-muted-foreground">LTM Volume</div>
              <div className="mt-0.5 text-[17px] font-extrabold">{formatCurrency(merchant.volume)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Transactions</div>
              <div className="mt-0.5 text-[17px] font-extrabold">{formatNumber(merchant.txn_count)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Effective Rate</div>
              <div className="mt-0.5 text-[20px] font-extrabold">{formatEffRate(effRate)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Net Revenue</div>
              <div
                className={cn(
                  "mt-0.5 text-[17px] font-extrabold",
                  merchant.net_revenue >= 0 ? "text-green-600" : "text-red-600",
                )}
              >
                {formatCurrencyExact(merchant.net_revenue)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Margin BPS</div>
              <div
                className={cn(
                  "mt-0.5 text-[20px] font-extrabold",
                  bpsColor(merchant.markup_bps, targetBps),
                )}
              >
                {formatBPS(merchant.markup_bps)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">
                Gap to Target ({formatBPS(targetBps)})
              </div>
              <div
                className={cn(
                  "mt-0.5 text-[20px] font-extrabold",
                  gap >= 0 ? "text-green-600" : gap >= -10 ? "text-amber-600" : "text-red-600",
                )}
              >
                {gap > 0 ? "+" : ""}
                {formatBPS(gap)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
