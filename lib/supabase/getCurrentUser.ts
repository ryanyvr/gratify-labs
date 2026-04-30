import { auth, currentUser } from "@clerk/nextjs/server";

import { APP_ROLES, type AppRole, type CurrentUser } from "@/lib/types/auth";

function resolveRole(roleValue: unknown): AppRole {
  if (typeof roleValue !== "string") {
    return "iso_user";
  }

  const role = roleValue as AppRole;
  return APP_ROLES.includes(role) ? role : "iso_user";
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const email = user?.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  )?.emailAddress;

  return {
    id: userId,
    email: email ?? "",
    role: resolveRole(user?.publicMetadata?.role),
  };
}
