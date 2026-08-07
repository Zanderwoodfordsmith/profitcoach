/** Browser-safe Sales Nav import types/constants (no apify-client). */

/**
 * Hard cap: LinkedIn allows ~100 search pages × 25 = 2,500 extractable results
 * per query. Each page ≈ 25 Short profiles.
 */
export const SALES_NAV_MAX_TAKE_PAGES = 100;
export const SALES_NAV_DEFAULT_TAKE_PAGES = 2;
/** Max leads at full LinkedIn extract depth. */
export const SALES_NAV_MAX_LEADS = SALES_NAV_MAX_TAKE_PAGES * 25;

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
  /** About / summary from Sales Nav Short scrape. */
  about: string | null;
  /** e.g. "6 yrs 5 mo in role · 6 yrs 5 mo in company" */
  tenureLabel: string | null;
  /** Total months in current company (from Short tenureAtCompany). */
  monthsAtCompany: number | null;
  /** Total months in current role (from Short tenureAtPosition). */
  monthsInRole: number | null;
  /**
   * Sales Nav YEARS_AT_CURRENT_COMPANY id derived from monthsAtCompany:
   * 1=<1yr, 2=1–2, 3=3–5, 4=6–10, 5=10+.
   */
  yearsAtCompanyBucket: "1" | "2" | "3" | "4" | "5" | null;
  /** LinkedIn CDN profile photo when Short scrape includes it. */
  photoUrl: string | null;
  premium: boolean;
  raw: Record<string, unknown>;
};
