import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  valueClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
}

export function KPICard({
  label,
  value,
  valueClassName,
  subtitle,
  subtitleClassName,
}: KPICardProps) {
  return (
    <Card className="p-4">
      <CardContent className="space-y-0.5 p-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={cn("text-[22px] font-extrabold leading-tight text-foreground", valueClassName)}>
          {value}
        </div>
        {subtitle ? (
          <div className={cn("text-[11px] text-muted-foreground", subtitleClassName)}>{subtitle}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
