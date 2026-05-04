"use client";

import { useRouter } from "next/navigation";
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
          <button
            key={partner.partner_name}
            type="button"
            className="rounded-lg border border-[#E5E7EB] bg-white p-5 text-left"
            onClick={() =>
              router.push(`/re-pricing/partners/${encodeURIComponent(partner.partner_name)}`)
            }
          >
            <h3 className="text-lg font-semibold text-[#1A1A2E]">{partner.partner_name}</h3>
            <p className="text-sm text-[#6B7280]">{partner.mcc_description ?? "N/A"}</p>
            <div className="mt-4 space-y-2 text-sm text-[#1A1A2E]">
              <p>{partner.merchant_count} merchants</p>
              <p>{formatCurrency(partner.total_volume)}</p>
            </div>
            <span
              className={`mt-4 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                underTarget ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              {underTarget
                ? `${Math.abs(delta).toFixed(1)} BPS under target`
                : `+${Math.abs(delta).toFixed(1)} BPS over target`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
