"use client";

import { DataTable } from "@/components/ui/DataTable";
import { formatCurrency, formatCurrencyExact, formatNumber, formatPercent } from "@/lib/formatters";
import type { NetworkFeeSummary } from "@/lib/types";

interface NetworkFeesTableProps {
  data: NetworkFeeSummary[];
}

export function NetworkFeesTable({ data }: NetworkFeesTableProps) {
  const totalFees = data.reduce((sum, row) => sum + row.total_fee, 0);

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1A1A2E]">Network & Service Fees</h3>
      <DataTable
        columns={[
          { key: "fee_description", label: "Fee Description" },
          {
            key: "total_fee",
            label: "Total Fee",
            align: "right",
            format: (value: unknown) => formatCurrencyExact(Number(value ?? 0)),
          },
          {
            key: "avg_rate",
            label: "Avg Rate",
            align: "right",
            format: (value: unknown) =>
              value === null || value === undefined ? "—" : formatPercent(Number(value)),
          },
          {
            key: "total_volume",
            label: "Based on Volume",
            align: "right",
            format: (value: unknown) =>
              value === null || value === undefined ? "—" : formatCurrency(Number(value)),
          },
          {
            key: "occurrences",
            label: "Occurrences",
            align: "right",
            format: (value: unknown) => formatNumber(Number(value ?? 0)),
          },
        ]}
        data={data}
      />
      <div className="mt-3 flex justify-end border-t border-[#E5E7EB] pt-3 text-sm font-semibold text-[#1A1A2E]">
        Total: {formatCurrencyExact(totalFees)}
      </div>
    </div>
  );
}
