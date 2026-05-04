"use client";

import { Building2, DollarSign, Percent, TrendingUp } from "lucide-react";
import { KPICard } from "@/components/ui/KPICard";
import { bpsColor, formatBPS, formatCurrency, formatPercent } from "@/lib/formatters";
import type { PortfolioMerchant } from "@/lib/types";

interface PortfolioKPIsProps {
  data: PortfolioMerchant[];
}

export function PortfolioKPIs({ data }: PortfolioKPIsProps) {
  const merchantCount = data.length;
  const totalVolume = data.reduce((sum, row) => sum + row.volume, 0);
  const totalMarkup = data.reduce((sum, row) => sum + row.markup, 0);
  const totalFees = data.reduce((sum, row) => sum + row.total_fees, 0);
  const avgMarkupBps = totalVolume > 0 ? (totalMarkup / totalVolume) * 10000 : 0;
  const avgEffectiveRate = totalVolume > 0 ? totalFees / totalVolume : 0;

  return (
    <div className="grid grid-cols-4 gap-5">
      <KPICard label="Active Merchants" value={merchantCount.toString()} icon={Building2} />
      <KPICard label="Total Volume" value={formatCurrency(totalVolume)} icon={DollarSign} />
      <KPICard
        label="Avg Markup"
        value={formatBPS(avgMarkupBps)}
        valueClassName={bpsColor(avgMarkupBps)}
        subtitle="vs 65 BPS target"
        icon={TrendingUp}
        trendColor={avgMarkupBps <= 65 ? "green" : avgMarkupBps <= 78 ? "amber" : "red"}
      />
      <KPICard
        label="Avg Effective Rate"
        value={formatPercent(avgEffectiveRate)}
        icon={Percent}
      />
    </div>
  );
}
