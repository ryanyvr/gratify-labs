import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backHref, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="mt-1 rounded-md p-1 text-[#6B7280] hover:bg-gray-100 hover:text-[#1A1A2E]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
