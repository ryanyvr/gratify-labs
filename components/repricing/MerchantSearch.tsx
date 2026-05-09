"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { MerchantTable } from "./MerchantTable";
import type { PortfolioMerchant } from "@/lib/repricing/types";

interface MerchantSearchProps {
  data: PortfolioMerchant[];
}

export function MerchantSearch({ data }: MerchantSearchProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) {
      return data;
    }

    const normalizedQuery = query.toLowerCase();

    return data.filter(
      (merchant) =>
        merchant.merchant_name.toLowerCase().includes(normalizedQuery) ||
        merchant.partner_name.toLowerCase().includes(normalizedQuery) ||
        (merchant.mcc?.toString() ?? "").includes(normalizedQuery),
    );
  }, [data, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Search merchants..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-lg border border-border-card bg-white py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <MerchantTable data={filtered} />
    </div>
  );
}
