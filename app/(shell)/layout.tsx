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
      <div className="pl-[260px] p-6">{children}</div>
    </div>
  );
}
