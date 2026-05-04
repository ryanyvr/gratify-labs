"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";
import { BarChart3, LayoutDashboard } from "lucide-react";
import clsx from "clsx";

export function Sidebar() {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();

  if (!isSignedIn) {
    return null;
  }

  const isLabsActive =
    pathname === "/dashboard" || pathname.startsWith("/features");
  const isRepricingActive = pathname.startsWith("/re-pricing");

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[260px] flex-col border-r border-border-card bg-white">
      <div className="border-b border-border-card px-6 py-6">
        <p className="text-xl font-bold tracking-wide text-text-primary">GRATIFY</p>
      </div>

      <div className="px-4 pt-6">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Labs
        </p>
        <Link
          href="/dashboard"
          className={clsx(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isLabsActive
              ? "bg-[#EDE9FE] text-[#5B21B6]"
              : "text-text-secondary hover:bg-gray-100 hover:text-text-primary",
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Home</span>
        </Link>
      </div>

      <div className="px-4 pt-6">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Insights
        </p>
        <Link
          href="/re-pricing/dashboard"
          className={clsx(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isRepricingActive
              ? "bg-[#EDE9FE] text-[#5B21B6]"
              : "text-text-secondary hover:bg-gray-100 hover:text-text-primary",
          )}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Portfolio</span>
        </Link>
      </div>

      <div className="mt-auto border-t border-border-card px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <UserButton />
          <p className="text-sm text-text-secondary">Prospect Demo</p>
        </div>
      </div>
    </aside>
  );
}
