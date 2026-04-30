import { getCurrentUser } from "@/lib/supabase/getCurrentUser";
import { createServiceRoleClient } from "@/lib/supabase/server";

type FeatureFlag = {
  allowed_roles: string[] | null;
  allowed_user_ids: string[] | null;
  enabled: boolean;
};

export async function getUserRole(userId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.id !== userId) {
    return "iso_user";
  }
  return user.role ?? "iso_user";
}

export async function checkFeatureAccess(
  featureSlug: string,
  userRole: string,
  userId: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("allowed_roles, allowed_user_ids, enabled")
    .eq("feature_slug", featureSlug)
    .eq("enabled", true)
    .maybeSingle<FeatureFlag>();

  if (error || !data) {
    return false;
  }

  const allowedUserIds = data.allowed_user_ids ?? [];
  const allowedRoles = data.allowed_roles ?? [];

  if (allowedUserIds.includes(userId)) {
    return true;
  }

  return requireRole(allowedRoles, userRole);
}

export function requireRole(allowedRoles: string[], userRole: string): boolean {
  return allowedRoles.includes(userRole);
}
