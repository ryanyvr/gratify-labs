"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "@/components/shell/Sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface ShellChromeProps {
  children: ReactNode;
}

export function ShellChrome({ children }: ShellChromeProps) {
  return (
    <SidebarProvider
      className="min-h-svh flex-col md:flex-row"
      style={{ "--sidebar-width": "260px" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="min-h-svh flex-1">
        <header className="flex items-center justify-end border-b border-border-card bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-text-primary">Fullsteam</p>
              <p className="text-xs text-text-secondary">Prospect Demo</p>
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
