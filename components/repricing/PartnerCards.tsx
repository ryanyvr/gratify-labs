"use client";

import { useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/repricing/formatters";
import { cn } from "@/lib/utils";
import type { PartnerSummary } from "@/lib/repricing/types";

interface PartnerCardsProps {
  data: PartnerSummary[];
}

export function PartnerCards({ data }: PartnerCardsProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-3 gap-5">
      {data.map((partner) => {
        const target = partner.target_bps ?? 65;
        const gap = partner.actual_bps - target;
        const pctOfTarget = target > 0 ? (partner.actual_bps / target) * 100 : 0;

        return (
          <Card
            key={partner.partner_name}
            className="cursor-pointer border-2 border-border transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() =>
              router.push(`/re-pricing/partners/${encodeURIComponent(partner.partner_name)}`)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/re-pricing/partners/${encodeURIComponent(partner.partner_name)}`);
              }
            }}
          >
            <CardContent className="p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-extrabold text-primary">
                {partner.partner_name.charAt(0)}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{partner.partner_name}</h3>
              <p className="text-sm text-muted-foreground">{partner.mcc_description ?? "N/A"}</p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Merchants
                  </div>
                  <div className="mt-0.5 text-[15px] font-extrabold">{partner.merchant_count}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Volume
                  </div>
                  <div className="mt-0.5 text-[15px] font-extrabold">
                    {formatCurrency(partner.total_volume)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Avg Margin
                  </div>
                  <div className="mt-0.5 text-[15px] font-extrabold">
                    {partner.actual_bps.toFixed(1)} BPS
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Net Revenue
                  </div>
                  <div className="mt-0.5 text-[15px] font-extrabold">
                    {formatCurrency(partner.total_markup)}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pctOfTarget > 80 ? "bg-green-500" : pctOfTarget > 50 ? "bg-amber-500" : "bg-red-500",
                    )}
                    style={{ width: `${Math.min(pctOfTarget, 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Math.abs(gap).toFixed(1)} BPS {gap > 0 ? "above" : "under"} target
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
