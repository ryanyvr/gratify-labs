"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/repricing/formatters";
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
        const delta = partner.actual_bps - target;
        const underTarget = delta <= 0;

        return (
          <Card
            key={partner.partner_name}
            className="cursor-pointer transition-shadow hover:shadow-md"
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
              <h3 className="text-lg font-semibold text-foreground">{partner.partner_name}</h3>
              <p className="text-sm text-muted-foreground">{partner.mcc_description ?? "N/A"}</p>
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <p>{partner.merchant_count} merchants</p>
                <p>{formatCurrency(partner.total_volume)}</p>
              </div>
              <Badge variant={underTarget ? "success" : "danger"} className="mt-4">
                {underTarget
                  ? `${Math.abs(delta).toFixed(1)} BPS under target`
                  : `+${Math.abs(delta).toFixed(1)} BPS over target`}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
