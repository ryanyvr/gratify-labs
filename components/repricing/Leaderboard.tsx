"use client";

import { useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  merchant_id: string;
  merchant_name: string;
  volume: number;
  markup_bps: number;
  target_bps?: number | null;
}

interface LeaderboardProps {
  data: LeaderboardEntry[];
  targetBps?: number;
}

export function Leaderboard({ data, targetBps = 62 }: LeaderboardProps) {
  const router = useRouter();
  const top5 = [...data].sort((a, b) => b.volume - a.volume).slice(0, 5);

  return (
    <Card>
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Top Merchants</h3>
      </div>
      <CardContent className="p-0">
        <table className="w-full text-[12px]">
          <tbody>
            {top5.map((merchant, index) => {
              const target = merchant.target_bps ?? targetBps;
              const bpsOk = merchant.markup_bps >= target;

              return (
                <tr
                  key={merchant.merchant_id}
                  onClick={() =>
                    router.push(
                      `/re-pricing/merchants/${encodeURIComponent(merchant.merchant_id)}`,
                    )
                  }
                  className="cursor-pointer transition-colors hover:bg-primary/5"
                >
                  <td className="border-b border-border px-2.5 py-2 font-bold">
                    <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-extrabold text-primary">
                      {index + 1}
                    </span>
                    {merchant.merchant_name}
                  </td>
                  <td className="border-b border-border px-2.5 py-2 text-right tabular-nums">
                    ${(merchant.volume / 1000).toFixed(0)}k
                  </td>
                  <td
                    className={cn(
                      "border-b border-border px-2.5 py-2 text-right font-bold tabular-nums",
                      bpsOk ? "text-green-600" : "text-red-600",
                    )}
                  >
                    {merchant.markup_bps.toFixed(1)} BPS
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
