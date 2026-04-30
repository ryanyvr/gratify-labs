export const APP_ROLES = [
  "labs_admin",
  "iso_user",
  "payfac_user",
  "acquirer_user",
  "merchant_user",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type CurrentUser = {
  id: string;
  email: string;
  role: AppRole;
};
