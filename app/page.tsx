import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-6xl flex-col items-center justify-center gap-5 px-4">
      <div className="text-3xl font-semibold tracking-tight">Gratify Labs</div>
      <div className="flex gap-3">
        <Link
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          href="/sign-in"
        >
          Sign in
        </Link>
        <Link
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          href="/dashboard"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
