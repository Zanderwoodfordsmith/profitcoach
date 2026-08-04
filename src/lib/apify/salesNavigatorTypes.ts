/** Browser-safe Sales Nav import types/constants (no apify-client). */

/** Hard cap: each page ≈ 25 profiles. */
export const SALES_NAV_MAX_TAKE_PAGES = 4;
export const SALES_NAV_DEFAULT_TAKE_PAGES = 2;

export type SalesNavImportedLead = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  company: string | null;
  linkedinUrl: string | null;
  location: string | null;
  email: string | null;
  headline: string | null;
  raw: Record<string, unknown>;
};
