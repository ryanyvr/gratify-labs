"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/repricing/ui/DataTable";
import {
  bpsColor,
  formatBPS,
  formatCurrency,
  formatCurrencyExact,
  formatEffRate,
  formatNumber,
  formatPercent,
} from "@/lib/repricing/formatters";
import type { PortfolioMerchant } from "@/lib/repricing/types";

interface MerchantTableProps {
  data: PortfolioMerchant[];
}

export function MerchantTable({ data }: MerchantTableProps) {
  const router = useRouter();

  const columns = useMemo(
    () => [
      { key: "merchant_name", label: "Merchant" },
      { key: "partner_name", label: "Partner" },
      {
        key: "pricing_type",
        label: "Pricing",
        format: (value: unknown) => (
          <Badge variant={String(value ?? "").toUpperCase() === "IC+" ? "info" : "secondary"}>
            {String(value ?? "Unknown")}
          </Badge>
        ),
      },
      {
        key: "volume",
        label: "Volume",
        align: "right" as const,
        format: (value: unknown) => formatCurrency(Number(value ?? 0)),
      },
      {
        key: "txn_count",
        label: "Txns",
        align: "right" as const,
        format: (value: unknown) => formatNumber(Number(value ?? 0)),
      },
      {
        key: "avg_ticket",
        label: "Avg Ticket",
        align: "right" as const,
        format: (value: unknown) => formatCurrencyExact(Number(value ?? 0)),
      },
      {
        key: "ic_pct",
        label: "IC %",
        align: "right" as const,
        format: (value: unknown) => formatPercent(Number(value ?? 0)),
      },
      {
        key: "markup_bps",
        label: "Markup BPS",
        align: "right" as const,
        format: (value: unknown) => (
          <span className={bpsColor(Number(value ?? 0))}>{formatBPS(Number(value ?? 0))}</span>
        ),
      },
      {
        key: "all_in_eff_rate",
        label: "Eff Rate",
        align: "right" as const,
        format: (_value: unknown, row: PortfolioMerchant) => {
          const allInER = row.volume > 0 ? (row.total_fees + row.monthly_fees) / row.volume : 0;
          return formatEffRate(allInER);
        },
      },
      {
        key: "monthly_fees",
        label: "Monthly Fees",
        align: "right" as const,
        format: (value: unknown) => formatCurrencyExact(Number(value ?? 0)),
      },
      {
        key: "network_costs",
        label: "Network Costs",
        align: "right" as const,
        format: (value: unknown) => formatCurrencyExact(Number(value ?? 0)),
      },
      {
        key: "net_revenue",
        label: "Net Revenue",
        align: "right" as const,
        format: (value: unknown) => formatCurrencyExact(Number(value ?? 0)),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      onRowClick={(row) =>
        router.push(`/re-pricing/merchants/${encodeURIComponent(row.merchant_id)}`)
      }
    />
  );
}
