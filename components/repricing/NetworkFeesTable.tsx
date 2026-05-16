"use client";

import { DataTable } from "@/components/repricing/ui/DataTable";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCurrency,
  formatCurrencyExact,
  formatNumber,
  formatPercent,
} from "@/lib/repricing/formatters";
import type { NetworkFeeSummary } from "@/lib/repricing/types";

interface NetworkFeesTableProps {
  data: NetworkFeeSummary[];
}

export function NetworkFeesTable({ data }: NetworkFeesTableProps) {
  const totalFees = data.reduce((sum, row) => sum + row.total_fee, 0);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Network & Service Fees</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          className="rounded-none border-0"
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
        <div className="flex justify-end border-t border-border px-6 py-3 text-sm font-semibold text-foreground">
          Total: {formatCurrencyExact(totalFees)}
        </div>
      </CardContent>
    </Card>
  );
}
