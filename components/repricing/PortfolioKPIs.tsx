"use client";

import { KPICard } from "@/components/repricing/ui/KPICard";
import { bpsColor, formatBPS, formatCurrency, formatEffRate } from "@/lib/repricing/formatters";
import type { PortfolioMerchant } from "@/lib/repricing/types";

interface PortfolioKPIsProps {
  data: PortfolioMerchant[];
}

export function PortfolioKPIs({ data }: PortfolioKPIsProps) {
  const merchantCount = data.length;
  const totalVolume = data.reduce((sum, row) => sum + row.volume, 0);
  const totalMarkup = data.reduce((sum, row) => sum + row.markup, 0);
  const totalFees = data.reduce((sum, row) => sum + row.total_fees, 0);
  const totalMonthlyFees = data.reduce((sum, row) => sum + row.monthly_fees, 0);
  const totalNetRevenue = data.reduce((sum, row) => sum + row.net_revenue, 0);
  const avgMarkupBps = totalVolume > 0 ? (totalMarkup / totalVolume) * 10000 : 0;
  const avgEffectiveRate = totalVolume > 0 ? (totalFees + totalMonthlyFees) / totalVolume : 0;

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      <KPICard label="Active Merchants" value={merchantCount.toString()} />
      <KPICard label="Total Volume" value={formatCurrency(totalVolume)} />
      <KPICard label="Net Revenue" value={formatCurrency(totalNetRevenue)} />
      <KPICard
        label="Avg Markup"
        value={formatBPS(avgMarkupBps)}
        valueClassName={bpsColor(avgMarkupBps)}
        subtitle="vs 65 BPS target"
        subtitleClassName={
          avgMarkupBps <= 65
            ? "text-green-600"
            : avgMarkupBps <= 78
              ? "text-amber-600"
              : "text-red-600"
        }
      />
      <KPICard label="Avg Effective Rate" value={formatEffRate(avgEffectiveRate)} />
    </div>
  );
}
