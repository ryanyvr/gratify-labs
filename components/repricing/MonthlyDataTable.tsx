"use client";

import { useMemo, useState } from "react";
import { formatBPS, formatCurrency, formatEffRate, formatNumber } from "@/lib/repricing/formatters";
import type { MonthlySummary } from "@/lib/repricing/types";

interface MonthlyDataTableProps {
  data: MonthlySummary[];
}

function formatMonthLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function MonthlyDataTable({ data }: MonthlyDataTableProps) {
  const [isOpen, setIsOpen] = useState(false);

  const rows = useMemo(
    () =>
      [...data]
        .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
        .map((row) => {
          const effRate = row.volume > 0 ? (row.total_fees + row.monthly_fees) / row.volume : 0;
          const nrBps = row.volume > 0 ? (row.net_revenue / row.volume) * 10000 : 0;
          const ebitda = row.net_revenue;

          return {
            month: formatMonthLabel(row.month),
            txns: formatNumber(row.txn_count),
            volume: formatCurrency(row.volume),
            totalFees: formatCurrency(row.total_fees),
            ic: formatCurrency(row.interchange),
            monthly: formatCurrency(row.monthly_fees),
            network: formatCurrency(row.network_costs),
            netRev: formatCurrency(row.net_revenue),
            ebitda: formatCurrency(ebitda),
            effRate: formatEffRate(effRate),
            nrBps: formatBPS(nrBps),
          };
        }),
    [data],
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-md border border-border-card bg-card px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-muted"
        >
          Data
        </button>
      </div>

      {isOpen ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {[
                  "Month",
                  "Txns",
                  "Volume",
                  "Total Fees",
                  "IC",
                  "Monthly",
                  "Network",
                  "Net Rev",
                  "EBITDA",
                  "Eff Rate",
                  "NR BPS",
                ].map((header) => (
                  <th
                    key={header}
                    className={`px-3 py-2 font-semibold text-muted-foreground ${
                      header === "Month" ? "text-left" : "text-right"
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month} className="border-t border-border text-foreground">
                  <td className="px-3 py-2 text-left">{row.month}</td>
                  <td className="px-3 py-2 text-right">{row.txns}</td>
                  <td className="px-3 py-2 text-right">{row.volume}</td>
                  <td className="px-3 py-2 text-right">{row.totalFees}</td>
                  <td className="px-3 py-2 text-right">{row.ic}</td>
                  <td className="px-3 py-2 text-right">{row.monthly}</td>
                  <td className="px-3 py-2 text-right">{row.network}</td>
                  <td className="px-3 py-2 text-right">{row.netRev}</td>
                  <td className="px-3 py-2 text-right">{row.ebitda}</td>
                  <td className="px-3 py-2 text-right">{row.effRate}</td>
                  <td className="px-3 py-2 text-right">{row.nrBps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
