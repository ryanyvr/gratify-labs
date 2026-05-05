import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  // ISSUE: [NON-BLOCKING] Root path was rendering a public shell instead of enforcing the auth gate expected by GRA-19.
  redirect(userId ? "/dashboard" : "/login");
}
