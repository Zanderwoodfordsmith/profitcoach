/**
 * Useful routes listed on Admin → Links (pages not in the main sidebar).
 */
export type AdminExtraNavLink = {
  href: string;
  label: string;
  /** Shown as secondary text on the Links page */
  hint?: string;
};

export const adminExtraNavLinks: AdminExtraNavLink[] = [
  {
    href: "/directory",
    label: "Coach directory",
    hint: "Public; coaches with directory listing on",
  },
  {
    href: "/ladder",
    label: "Profit Coach Ladder",
    hint: "Promotion → proof → prestige",
  },
  {
    href: "/landing",
    label: "Landing (A/B entry)",
    hint: "Optional ?coach= slug; picks variant A or B",
  },
  {
    href: "/admin/landing-analytics",
    label: "Landing analytics",
    hint: "Boss Score landing views, opt-ins, and per-coach breakdown",
  },
  {
    href: "/admin/sales-nav-imports",
    label: "Sales Nav imports",
    hint: "Apify scrape runs: who, counts, new vs updated, estimated cost",
  },
  {
    href: "/assessment",
    label: "BOSS Scorecard",
    hint: "Default route redirects to /assessment/BCA (13-question funnel)",
  },
  {
    href: "/assessment-pro",
    label: "Boss Pro assessment",
    hint: "50-question Boss Pro; /diagnostic redirects here",
  },
  {
    href: "/join",
    label: "Program join",
    hint: "Open coach signup (same flow as /signup)",
  },
  {
    href: "/signup",
    label: "Signup",
    hint: "Open coach signup",
  },
  {
    href: "/admin/client-success",
    label: "Client success matrix",
    hint: "Also under Coaches hub tabs",
  },
  {
    href: "/admin/funnel-settings",
    label: "My native booking (hours)",
    hint: "Set your own availability — no impersonation. Book link appears after save.",
  },
  {
    href: "/zander",
    label: "My public book page (/zander)",
    hint: "Enable booking under Funnel settings first, then share this URL.",
  },
];
