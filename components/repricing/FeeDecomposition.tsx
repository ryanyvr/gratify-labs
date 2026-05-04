"use client";

import { Badge } from "@/components/repricing/ui/Badge";
import { DataTable } from "@/components/repricing/ui/DataTable";
import {
  formatCurrency,
  formatCurrencyExact,
  formatNumber,
  formatPercent,
} from "@/lib/repricing/formatters";
import type { FeeDecomposition as FeeDecompositionType } from "@/lib/repricing/types";

interface FeeDecompositionProps {
  data: FeeDecompositionType[];
}

export function FeeDecomposition({ data }: FeeDecompositionProps) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1A1A2E]">Fee Decomposition by Card Brand</h3>
      <DataTable
        columns={[
          { key: "card_brand", label: "Card Brand" },
          {
            key: "is_card_present",
            label: "Entry",
            format: (value: unknown) => (
              <Badge label={value ? "CP" : "CNP"} variant={value ? "success" : "info"} />
            ),
          },
          {
            key: "volume",
            label: "Volume",
            align: "right",
            format: (value: unknown) => formatCurrency(Number(value ?? 0)),
          },
          {
            key: "txn_count",
            label: "Txns",
            align: "right",
            format: (value: unknown) => formatNumber(Number(value ?? 0)),
          },
          {
            key: "ic_pct",
            label: "IC %",
            align: "right",
            format: (value: unknown) => formatPercent(Number(value ?? 0)),
          },
          {
            key: "markup",
            label: "Markup",
            align: "right",
            format: (value: unknown) => formatCurrencyExact(Number(value ?? 0)),
          },
          {
            key: "total_fees",
            label: "Total Fees",
            align: "right",
            format: (value: unknown) => formatCurrencyExact(Number(value ?? 0)),
          },
        ]}
        data={data}
      />
    </div>
  );
}
