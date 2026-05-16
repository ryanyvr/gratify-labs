"use client";

import { SignOutButton } from "@clerk/nextjs";

const buttonClassName =
  "cursor-pointer rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10";

export function DashboardSignOut() {
  return (
    <SignOutButton redirectUrl="/login">
      <button className={buttonClassName} type="button">
        Sign out
      </button>
    </SignOutButton>
  );
}
