"use client";

import { cn } from "@/lib/utils";

import { usePeriod, type Period } from "./PeriodContext";

const pills: { label: string; value: Period }[] = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "LTM", value: 12 },
  { label: "All", value: 0 },
];

export function PeriodPills() {
  const { period, setPeriod } = usePeriod();

  return (
    <div className="flex gap-1">
      {pills.map((pill) => (
        <button
          key={pill.value}
          type="button"
          onClick={() => setPeriod(pill.value)}
          className={cn(
            "rounded-full border-[1.5px] px-3.5 py-1 text-[11px] font-bold transition-all",
            period === pill.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground",
          )}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}
