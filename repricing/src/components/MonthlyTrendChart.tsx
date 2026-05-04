"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBPS, formatCurrency } from "@/lib/formatters";
import type { MonthlySummary } from "@/lib/types";

interface MonthlyTrendChartProps {
  data: MonthlySummary[];
}

function formatMonthLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '");
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1A1A2E]">Monthly Trend</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <XAxis dataKey="month" tickFormatter={formatMonthLabel} />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => `$${Math.round(value / 1000)}K`}
            />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}`} />
            <Tooltip
              formatter={(value, name) => {
                const n = typeof value === "number" ? value : Number(value);
                if (name === "volume") return [formatCurrency(n), "Volume"];
                if (name === "markup_bps") return [formatBPS(n), "Markup BPS"];
                return [String(value ?? ""), String(name ?? "")];
              }}
              labelFormatter={(label) => formatMonthLabel(String(label))}
            />
            <Bar dataKey="volume" fill="#4A8FE7" yAxisId="left" />
            <Line dataKey="markup_bps" stroke="#E8573A" yAxisId="right" strokeWidth={2} />
            <ReferenceLine
              y={65}
              yAxisId="right"
              stroke="#9CA3AF"
              strokeDasharray="5 5"
              label="Target 65 BPS"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
