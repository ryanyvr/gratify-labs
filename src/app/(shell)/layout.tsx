import { Inter } from "next/font/google";

import { PeriodProvider } from "@/components/shell/PeriodContext";
import { ShellChrome } from "@/components/shell/ShellChrome";

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
      <PeriodProvider>
        <ShellChrome>{children}</ShellChrome>
      </PeriodProvider>
    </div>
  );
}
