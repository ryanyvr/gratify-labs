import { Inter } from "next/font/google";
import { Sidebar } from "@/components/shell/Sidebar";

const inter = Inter({
  subsets: ["latin"],
});

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.className} min-h-screen bg-bg-page text-text-primary antialiased`}>
      <Sidebar />
      <div className="pl-[260px]">
        <header className="flex items-center justify-end border-b border-border-card bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-text-primary">Fullsteam</p>
              <p className="text-xs text-text-secondary">Prospect Demo</p>
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
