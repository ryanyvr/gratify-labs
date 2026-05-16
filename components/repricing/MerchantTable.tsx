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
} from "@/lib/repricing/formatters";
import { cn } from "@/lib/utils";
import type { PortfolioMerchant } from "@/lib/repricing/types";

interface MerchantTableProps {
  data: PortfolioMerchant[];
  embedded?: boolean;
}

type MerchantRow = PortfolioMerchant & {
  target_bps?: number | null;
  mcc_description?: string | null;
};

function getTargetBps(row: MerchantRow): number {
  return row.target_bps ?? 62;
}

function getGap(row: MerchantRow): number {
  return row.markup_bps - getTargetBps(row);
}

function getStatus(row: MerchantRow): "On Target" | "Below Target" | "Critical" {
  const gap = getGap(row);
  if (gap >= 0) return "On Target";
  if (gap >= -10) return "Below Target";
  return "Critical";
}

function statusVariant(status: ReturnType<typeof getStatus>) {
  if (status === "On Target") return "success" as const;
  if (status === "Below Target") return "warning" as const;
  return "danger" as const;
}

export function MerchantTable({ data, embedded }: MerchantTableProps) {
  const router = useRouter();

  const columns = useMemo(
    () => [
      {
        key: "merchant_name",
        label: "Merchant",
        format: (_value: unknown, row: MerchantRow) => {
          // TODO: mcc_description not in current materialized view
          const mccDescription = row.mcc_description ?? "";
          return (
            <span>
              <span className="font-bold">{row.merchant_name}</span>
              {mccDescription ? (
                <small className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                  {mccDescription}
                </small>
              ) : null}
            </span>
          );
        },
        sortValue: (row: MerchantRow) => row.merchant_name,
      },
      {
        key: "partner_name",
        label: "Partner",
        sortValue: (row: MerchantRow) => row.partner_name,
      },
      {
        key: "volume",
        label: "Volume",
        align: "right" as const,
        format: (value: unknown) => formatCurrency(Number(value ?? 0)),
        sortValue: (row: MerchantRow) => row.volume,
      },
      {
        key: "markup_bps",
        label: "Margin BPS",
        align: "right" as const,
        format: (value: unknown, row: MerchantRow) => {
          const target = getTargetBps(row);
          const bps = Number(value ?? 0);
          return (
            <span className={cn("font-bold", bpsColor(bps, target))}>{formatBPS(bps)}</span>
          );
        },
        sortValue: (row: MerchantRow) => row.markup_bps,
      },
      {
        key: "net_revenue",
        label: "Net Revenue",
        align: "right" as const,
        format: (value: unknown) => {
          const revenue = Number(value ?? 0);
          return (
            <span className={revenue >= 0 ? "text-green-600" : "text-red-600"}>
              {formatCurrencyExact(revenue)}
            </span>
          );
        },
        sortValue: (row: MerchantRow) => row.net_revenue,
      },
      {
        key: "target_bps",
        label: "Target BPS",
        align: "right" as const,
        format: (_value: unknown, row: MerchantRow) => formatBPS(getTargetBps(row)),
        sortValue: (row: MerchantRow) => getTargetBps(row),
      },
      {
        key: "gap",
        label: "Gap",
        align: "right" as const,
        format: (_value: unknown, row: MerchantRow) => {
          const gap = getGap(row);
          return (
            <span
              className={cn(
                "font-bold",
                gap >= 0 ? "text-green-600" : gap >= -10 ? "text-amber-600" : "text-red-600",
              )}
            >
              {gap > 0 ? "+" : ""}
              {formatBPS(gap)}
            </span>
          );
        },
        sortValue: (row: MerchantRow) => getGap(row),
      },
      {
        key: "status",
        label: "Status",
        format: (_value: unknown, row: MerchantRow) => {
          const status = getStatus(row);
          return <Badge variant={statusVariant(status)}>{status}</Badge>;
        },
        sortValue: (row: MerchantRow) => getStatus(row),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      className={embedded ? "rounded-none border-0" : undefined}
      onRowClick={(row) =>
        router.push(`/re-pricing/merchants/${encodeURIComponent(row.merchant_id)}`)
      }
    />
  );
}
