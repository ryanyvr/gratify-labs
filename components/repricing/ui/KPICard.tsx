import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  valueClassName?: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendColor?: "green" | "red" | "amber";
}

const trendColorClasses: Record<NonNullable<KPICardProps["trendColor"]>, string> = {
  green: "text-green-600",
  red: "text-red-600",
  amber: "text-amber-600",
};

export function KPICard({
  label,
  value,
  valueClassName,
  subtitle,
  icon: Icon,
  trend,
  trendColor = "green",
}: KPICardProps) {
  const trendPrefix = trend === "up" ? "↑ " : trend === "down" ? "↓ " : "";

  return (
    <Card className="p-5">
      <CardContent className="p-0">
        <Icon className="mb-4 h-5 w-5 text-text-tertiary" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-3xl font-bold leading-tight text-foreground", valueClassName)}>
          {value}
        </p>
        {subtitle ? (
          <p className={cn("mt-2 text-xs", trendColorClasses[trendColor])}>
            {trendPrefix}
            {subtitle}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
