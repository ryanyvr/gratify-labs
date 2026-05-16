"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrency } from "@/lib/repricing/formatters";
import type { MonthlySummary } from "@/lib/repricing/types";

type PeriodOption = 3 | 6 | 12 | 0;

interface WaterfallChartProps {
  data: MonthlySummary[];
  period: PeriodOption;
}

interface WaterfallBar {
  name: string;
  bottom: number;
  value: number;
  color: string;
}

const PERIOD_OPTIONS: Array<{ value: PeriodOption; label: string }> = [
  { value: 3, label: "3mo" },
  { value: 6, label: "6mo" },
  { value: 12, label: "12mo" },
  { value: 0, label: "All" },
];

function sumBy(rows: MonthlySummary[], selector: (row: MonthlySummary) => number): number {
  return rows.reduce((acc, row) => acc + selector(row), 0);
}

function toChartRows(bars: Array<{ label: string[]; range: [number, number]; color: string }>): WaterfallBar[] {
  return bars.map((bar) => {
    const low = Math.min(bar.range[0], bar.range[1]);
    const high = Math.max(bar.range[0], bar.range[1]);
    return {
      name: bar.label.join(" "),
      bottom: low,
      value: high - low,
      color: bar.color,
    };
  });
}

export function WaterfallChart({ data, period }: WaterfallChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(period);

  const scopedData = useMemo(() => {
    const sorted = [...data].sort(
      (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime(),
    );

    if (selectedPeriod === 0) {
      return sorted;
    }

    return sorted.slice(-selectedPeriod);
  }, [data, selectedPeriod]);

  const chartData = useMemo<WaterfallBar[]>(() => {
    const allIn = sumBy(scopedData, (row) => row.total_fees) + sumBy(scopedData, (row) => row.monthly_fees);
    const ic = sumBy(scopedData, (row) => row.interchange);
    const nw = sumBy(scopedData, (row) => row.network_costs);
    const nr = sumBy(scopedData, (row) => row.net_revenue);
    const ebitda = nr;

    return toChartRows([
      {
        label: ["All-In", "Revenue"],
        range: [0, allIn],
        color: "#0171FF",
      },
      {
        label: ["Interchange"],
        range: [allIn - ic, allIn],
        color: "#DC2626",
      },
      {
        label: ["Network", "Costs"],
        range: [allIn - ic - nw, allIn - ic],
        color: "#DC2626",
      },
      {
        label: ["ACH+CB"],
        range: [nr, allIn - ic - nw],
        color: "#DC2626",
      },
      {
        label: ["Net", "Revenue"],
        range: [0, nr],
        color: "#0171FF",
      },
      {
        label: ["Install+", "PayFac"],
        range: [ebitda, nr],
        color: "#DC2626",
      },
      {
        label: ["EBITDA"],
        range: [0, ebitda],
        color: "#16A34A",
      },
    ]);
  }, [scopedData]);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Fee Waterfall</CardTitle>
        <CardAction>
          <ToggleGroup
            type="single"
            value={String(selectedPeriod)}
            onValueChange={(value) => {
              if (value) {
                setSelectedPeriod(Number(value) as PeriodOption);
              }
            }}
          >
            {PERIOD_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.value} value={String(option.value)} className="text-xs">
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(Number(value))}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Math.abs(Number(value ?? 0)))}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="bottom" stackId="waterfall" fill="transparent" radius={[0, 0, 0, 0]} />
              <Bar dataKey="value" stackId="waterfall" radius={[6, 6, 6, 6]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
