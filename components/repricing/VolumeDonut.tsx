"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/repricing/formatters";
import type { MonthlySummary } from "@/lib/repricing/types";

interface VolumeDonutProps {
  data: MonthlySummary[];
}

export function VolumeDonut({ data }: VolumeDonutProps) {
  const cpVolume = data.reduce((sum, row) => sum + row.cp_volume, 0);
  const cnpVolume = data.reduce((sum, row) => sum + row.cnp_volume, 0);
  const total = cpVolume + cnpVolume;

  const chartData = [
    { name: "CP", value: cpVolume, fill: "#4A8FE7" },
    { name: "CNP", value: cnpVolume, fill: "#22C55E" },
  ];

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1A1A2E]">Card Present vs Card Not Present</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              label={(entry) =>
                `${entry.name}: ${total ? ((entry.value / total) * 100).toFixed(1) : "0.0"}%`
              }
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                formatCurrency(typeof value === "number" ? value : Number(value))
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 space-y-1 text-sm text-[#6B7280]">
        <p>CP: {formatCurrency(cpVolume)}</p>
        <p>CNP: {formatCurrency(cnpVolume)}</p>
      </div>
    </div>
  );
}
