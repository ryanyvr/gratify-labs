"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import {
  bpsColor,
  formatBPS,
  formatCurrency,
  formatCurrencyExact,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import type { PortfolioMerchant } from "@/lib/types";

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
          <Badge
            label={String(value ?? "Unknown")}
            variant={String(value ?? "").toUpperCase() === "IC+" ? "info" : "default"}
          />
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
        key: "eff_rate_pct",
        label: "Eff Rate",
        align: "right" as const,
        format: (value: unknown) => formatPercent(Number(value ?? 0)),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      onRowClick={(row) => router.push(`/merchants/${encodeURIComponent(row.merchant_id)}`)}
    />
  );
}
