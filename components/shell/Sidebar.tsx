"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";
import { BarChart3, LayoutDashboard } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();

  if (!isSignedIn) {
    return null;
  }

  const isLabsActive = pathname === "/dashboard" || pathname.startsWith("/features");
  const isRepricingActive = pathname.startsWith("/re-pricing");

  return (
    <Sidebar collapsible="none" className="w-full border-r border-sidebar-border md:w-(--sidebar-width)">
      <SidebarHeader className="border-b border-sidebar-border px-6 py-6">
        <img
          src="https://cdn.prod.website-files.com/68a8894d1825fae84cef756c/68a88a91a869822cd1e2c5dd_Blue%20logo%20-%20no%20background-p-500.png"
          alt="Gratify"
          className="h-7 w-auto"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Labs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isLabsActive}>
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Insights</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRepricingActive}>
                  <Link href="/re-pricing/dashboard">
                    <BarChart3 />
                    <span>Portfolio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <UserButton />
          <p className="text-sm text-sidebar-foreground">Prospect Demo</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
