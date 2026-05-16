"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { MerchantTable } from "./MerchantTable";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    <Card>
      <CardHeader className="border-b">
        <CardTitle>All Merchants</CardTitle>
        <CardAction>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search merchants..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <MerchantTable data={filtered} embedded />
      </CardContent>
    </Card>
  );
}
