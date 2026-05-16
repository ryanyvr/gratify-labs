"use client";

import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  LinearScale,
  Tooltip,
  type Plugin,
} from "chart.js";
import { formatCurrency } from "@/lib/repricing/formatters";
import type { MonthlySummary } from "@/lib/repricing/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type PeriodOption = 3 | 6 | 12 | 0;

interface WaterfallChartProps {
  data: MonthlySummary[];
  period: PeriodOption;
}

interface WaterfallBar {
  label: string[];
  range: [number, number];
  color: string;
  exit: number;
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

  const bars = useMemo<WaterfallBar[]>(() => {
    const allIn = sumBy(scopedData, (row) => row.total_fees) + sumBy(scopedData, (row) => row.monthly_fees);
    const ic = sumBy(scopedData, (row) => row.interchange);
    const nw = sumBy(scopedData, (row) => row.network_costs);
    const achcb = 0;
    const nr = sumBy(scopedData, (row) => row.net_revenue);
    const instpf = 0;
    const ebitda = nr;

    return [
      {
        label: ["All-In", "Revenue"],
        range: [0, allIn],
        color: "#0171FF",
        exit: allIn,
      },
      {
        label: ["Interchange"],
        range: [allIn - ic, allIn],
        color: "#DC2626",
        exit: allIn - ic,
      },
      {
        label: ["Network", "Costs"],
        range: [allIn - ic - nw, allIn - ic],
        color: "#DC2626",
        exit: allIn - ic - nw,
      },
      {
        label: ["ACH+CB"],
        range: [nr, allIn - ic - nw],
        color: "#DC2626",
        exit: nr,
      },
      {
        label: ["Net", "Revenue"],
        range: [0, nr],
        color: "#0171FF",
        exit: nr,
      },
      {
        label: ["Install+", "PayFac"],
        range: [ebitda, nr],
        color: "#DC2626",
        exit: ebitda,
      },
      {
        label: ["EBITDA"],
        range: [0, ebitda],
        color: "#16A34A",
        exit: ebitda,
      },
    ];
  }, [scopedData]);

  const connectorPlugin = useMemo<Plugin<"bar">>(
    () => ({
      id: "wfConnectors",
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        const ctx = chart.ctx;

        ctx.save();
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);

        for (let index = 0; index < meta.data.length - 1; index += 1) {
          const currentElement = meta.data[index];
          const nextElement = meta.data[index + 1];
          const exitValue = bars[index]?.exit;

          if (
            exitValue === undefined ||
            !(currentElement instanceof BarElement) ||
            !(nextElement instanceof BarElement)
          ) {
            continue;
          }

          const { x: currentX, width: currentWidth } = currentElement.getProps(["x", "width"], true);
          const { x: nextX, width: nextWidth } = nextElement.getProps(["x", "width"], true);

          if (
            currentX === null ||
            currentWidth === null ||
            nextX === null ||
            nextWidth === null
          ) {
            continue;
          }

          const yLine = chart.scales.y.getPixelForValue(exitValue);
          const x1 = currentX + currentWidth / 2;
          const x2 = nextX - nextWidth / 2;

          ctx.beginPath();
          ctx.moveTo(x1, yLine);
          ctx.lineTo(x2, yLine);
          ctx.stroke();
        }

        ctx.restore();
      },
    }),
    [bars],
  );

  const chartData = useMemo<ChartData<"bar">>(
    () => ({
      labels: bars.map((bar) => bar.label),
      datasets: [
        {
          data: bars.map((bar) => bar.range),
          backgroundColor: bars.map((bar) => bar.color),
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.7,
        },
      ],
    }),
    [bars],
  );

  const options = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              const range = (context.raw as [number, number]) ?? [0, 0];
              const [start, end] = range;
              return formatCurrency(Math.abs(end - start));
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            color: "#475569",
            font: {
              size: 11,
            },
          },
          border: {
            display: false,
          },
        },
        y: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            callback(value) {
              return formatCurrency(Number(value));
            },
          },
          border: {
            display: false,
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Fee Waterfall</h3>
        <div className="flex items-center gap-2 rounded-md bg-muted p-1">
          {PERIOD_OPTIONS.map((option) => {
            const isActive = option.value === selectedPeriod;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedPeriod(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-white text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="h-80">
        <Bar data={chartData} options={options} plugins={[connectorPlugin]} />
      </div>
    </div>
  );
}
