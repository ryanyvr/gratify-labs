import { getCurrentUser } from "@/lib/supabase/getCurrentUser";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types/auth";

type FeatureFlag = {
  allowed_roles: string[];
  allowed_user_ids: string[];
  enabled: boolean;
};

export async function getUserRole(): Promise<AppRole> {
  const user = await getCurrentUser();
  return user?.role ?? "iso_user";
}

export async function checkFeatureAccess(featureSlug: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) {
    return false;
  }

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

  if (data.allowed_user_ids.includes(user.id)) {
    return true;
  }

  return data.allowed_roles.includes(user.role);
}

export function requireRole(userRole: AppRole, allowedRoles: AppRole[]): boolean {
  return allowedRoles.includes(userRole);
}
