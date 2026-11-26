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
    href: "/admin/academy/classroom/working/core-client",
    label: "Working lesson (Core Client)",
    hint: "Prototype: classroom layout with the artifact-first AI format",
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
    href: "/welcome?preview=1",
    label: "Just paid → welcome (preview)",
    hint: "Admin only — post-checkout onboarding without Stripe",
  },
  {
    href: "/signup",
    label: "Signup",
    hint: "Open coach signup",
  },

  {
    href: "/admin/client-success",
    label: "Client success matrix",
    hint: "Signature scores per coach (off the Coaches tabs for now)",
  },
  {
    href: "/admin/client-success/revenue",
    label: "Coach income",
    hint: "Cash coaches have logged themselves (off the Coaches tabs for now)",
  },
  {
    href: "/admin/client-success/usage",
    label: "Coach usage",
    hint: "Who is active in the app, by role, over 30 days (off the Coaches tabs since 16 Nov)",
  },
  {
    href: "/admin/campaigns/invites",
    label: "LinkedIn invites waiting",
    hint: "Withdraw connection requests nobody has accepted, by hand or on a schedule",
  },
  {
    href: "/admin/linkedin-inbox",
    label: "LinkedIn inbox copy",
    hint: "Your last 3 LinkedIn threads, saved by the Chrome extension's inbox sync button",
  },
  {
    href: "/admin/risk",
    label: "Risk Playbook",
    hint: "What could sink a business: every thinker's answer side by side",
  },
  {
    href: "/admin/risk/model",
    label: "Risk model (draft)",
    hint: "Ten risks in one picture",
  },
  {
    href: "/admin/academy/classroom/weekly-focus",
    label: "Weekly Focus",
    hint: "This week's Classroom focus, with past weeks",
  },
  {
    href: "/admin/lesson-import",
    label: "Lesson import status",
    hint: "Video, content and transcript cover for each Classroom lesson. Links to the growth system overview.",
  },
  {
    href: "/admin/academy/resources/list",
    label: "Old resources list",
    hint: "The list from before the Resource Library. Still the only place to delete a resource.",
  },
  {
    href: "/admin/calls?tab=settings",
    label: "My native booking (hours)",
    hint: "Set your own availability — no impersonation. Book link appears after save.",
  },
  {
    href: "/zander",
    label: "My public book page (/zander)",
    hint: "Enable booking under Calls → Booking pages first, then share this URL.",
  },
];
