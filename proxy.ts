import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { checkFeatureAccess, getUserRole } from "@/lib/rbac";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)"]);
const isFeatureRoute = createRouteMatcher(["/features/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.next();
  }

  const userRole = await getUserRole(userId);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-role", userRole);

  if (isFeatureRoute(req)) {
    const [, , slug] = req.nextUrl.pathname.split("/");
    const hasAccess = slug
      ? await checkFeatureAccess(slug, userRole, userId)
      : false;

    if (!hasAccess) {
      const deniedUrl = new URL("/dashboard?denied=true", req.url);
      return NextResponse.redirect(deniedUrl);
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
