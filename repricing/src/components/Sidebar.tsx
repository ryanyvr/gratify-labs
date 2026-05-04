"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { BarChart3 } from "lucide-react";
import clsx from "clsx";

export function Sidebar() {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();

  if (!isSignedIn) {
    return null;
  }

  const isPortfolioActive =
    pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/merchants");

  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] bg-white border-r border-border-card flex flex-col">
      <div className="px-6 py-6 border-b border-border-card">
        <p className="text-xl font-bold tracking-wide text-text-primary">GRATIFY</p>
      </div>

      <div className="px-4 pt-6">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Insights
        </p>
        <Link
          href="/dashboard"
          className={clsx(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isPortfolioActive
              ? "bg-[#EDE9FE] text-[#5B21B6]"
              : "text-text-secondary hover:bg-gray-100 hover:text-text-primary",
          )}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Portfolio</span>
        </Link>
      </div>

      <div className="mt-auto px-6 py-4 border-t border-border-card">
        <p className="text-sm text-text-secondary">Prospect Demo</p>
      </div>
    </aside>
  );
}
