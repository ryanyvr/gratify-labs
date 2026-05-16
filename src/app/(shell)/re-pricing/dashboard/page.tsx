import { MerchantSearch } from "@/components/repricing/MerchantSearch";
import { PartnerCards } from "@/components/repricing/PartnerCards";
import { PortfolioKPIs } from "@/components/repricing/PortfolioKPIs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/repricing/ui/PageHeader";
import { getPartnerSummary, getPortfolioSummary } from "@/lib/repricing/queries";

export const dynamic = "force-dynamic";

export default async function RePricingDashboardPage() {
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
        <Badge variant="secondary">{portfolioData.length}</Badge>
      </div>
      <MerchantSearch data={portfolioData} />
    </div>
  );
}
