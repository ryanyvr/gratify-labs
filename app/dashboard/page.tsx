import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

import DeniedToast from "@/app/dashboard/DeniedToast";
import { getCurrentUser } from "@/lib/supabase/getCurrentUser";

type DashboardPageProps = {
  searchParams: Promise<{ denied?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getCurrentUser();
  const { denied } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DeniedToast show={denied === "true"} />
      <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm">Signed in as: {user?.email || "unknown email"}</p>
        <p className="text-sm">Role: {user?.role || "iso_user"}</p>
        <p className="text-xs opacity-70">User ID: {user?.id || "unknown user"}</p>
      </div>
      <div className="flex gap-3">
        <Link
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          href="/features/shell"
        >
          Open shell feature
        </Link>
        <SignOutButton signOutOptions={{ redirectUrl: "/login" }}>
          <button
            className="cursor-pointer rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
            type="button"
          >
            Sign out
          </button>
        </SignOutButton>
      </div>
    </main>
  );
}
