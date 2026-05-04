import { MerchantTable } from "@/components/MerchantTable";
import { PartnerCards } from "@/components/PartnerCards";
import { PortfolioKPIs } from "@/components/PortfolioKPIs";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPartnerSummary, getPortfolioSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [portfolioData, partnerData] = await Promise.all([
    getPortfolioSummary(),
    getPartnerSummary(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Portfolio Health" subtitle="Re-Pricing Dashboard" />
      <PortfolioKPIs data={portfolioData} />
      <PartnerCards data={partnerData} />
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-[#1A1A2E]">Merchants</h2>
        <Badge label={String(portfolioData.length)} variant="default" />
      </div>
      <MerchantTable data={portfolioData} />
    </div>
  );
}
