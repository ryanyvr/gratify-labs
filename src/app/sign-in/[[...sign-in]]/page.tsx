import { redirect } from "next/navigation";

export default function SignInPage() {
  // ISSUE: [NON-BLOCKING] Legacy `/sign-in` path conflicted with the `/login` acceptance flow; keep backward compatibility by redirecting.
  redirect("/login");
}
