import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gratify Re-Pricing Dashboard",
  description: "Re-Pricing portfolio health dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.className} h-full antialiased`}>
        <body className="min-h-full bg-[#F5F5F7] text-text-primary">
          <div className="min-h-screen">
            <Sidebar />
            <main className="pl-[260px] p-6">{children}</main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
