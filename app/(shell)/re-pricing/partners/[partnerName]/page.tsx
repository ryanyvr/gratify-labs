import { Building2, DollarSign, Percent, TrendingUp } from "lucide-react";
import { MerchantTable } from "@/components/repricing/MerchantTable";
import { Badge } from "@/components/repricing/ui/Badge";
import { KPICard } from "@/components/repricing/ui/KPICard";
import { PageHeader } from "@/components/repricing/ui/PageHeader";
import { bpsColor, formatBPS, formatCurrency, formatNumber } from "@/lib/repricing/formatters";
import { getPartnerMerchants } from "@/lib/repricing/queries";
import { supabase } from "@/lib/repricing/supabase";
import type { PartnerSummary } from "@/lib/repricing/types";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export const dynamic = "force-dynamic";

interface PartnerPageProps {
  params: Promise<{ partnerName: string }>;
}

export default async function RePricingPartnerPage({ params }: PartnerPageProps) {
  const { partnerName: encoded } = await params;
  const partnerName = decodeURIComponent(encoded);

  const [{ data: partner, error }, merchants] = await Promise.all([
    supabase
      .from("mv_partner_summary")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("partner_name", partnerName)
      .single<PartnerSummary>(),
    getPartnerMerchants(partnerName),
  ]);

  if (error || !partner) {
    throw error ?? new Error("Partner not found");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/re-pricing/dashboard"
        title={partner.partner_name}
        subtitle={partner.mcc_description ?? undefined}
      />

      <div className="grid grid-cols-4 gap-5">
        <KPICard
          label="Merchants"
          value={formatNumber(partner.merchant_count)}
          icon={Building2}
        />
        <KPICard label="Total Volume" value={formatCurrency(partner.total_volume)} icon={DollarSign} />
        <KPICard
          label="Actual BPS"
          value={formatBPS(partner.actual_bps)}
          valueClassName={bpsColor(partner.actual_bps)}
          icon={TrendingUp}
        />
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5">
          <Percent className="mb-4 h-5 w-5 text-[#9CA3AF]" />
          <p className="text-[13px] font-medium text-[#6B7280]">BPS Variance</p>
          <div className="mt-2">
            <Badge
              label={`${partner.bps_variance >= 0 ? "+" : ""}${partner.bps_variance.toFixed(1)}`}
              variant={partner.bps_variance <= 0 ? "success" : "danger"}
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-[#1A1A2E]">Merchants</h2>
        <MerchantTable data={merchants} />
      </div>
    </div>
  );
}
