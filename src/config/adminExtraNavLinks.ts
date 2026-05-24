/**
 * Useful routes that are not in the main admin sidebar (see admin/layout.tsx).
 */
export type AdminExtraNavLink = {
  href: string;
  label: string;
  /** Shown as secondary text on Account → Links */
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
    href: "/assessment",
    label: "BOSS Scorecard",
    hint: "Default route redirects to /assessment/BCA (13-question funnel)",
  },
  {
    href: "/diagnostic",
    label: "Legacy 50-q diagnostic",
    hint: "Preserved full diagnostic for client retakes",
  },
  {
    href: "/join",
    label: "Program join",
    hint: "Coach signup via program link",
  },
  {
    href: "/signup",
    label: "Signup",
    hint: "Profit Coach coach signup",
  },
  {
    href: "/admin/client-success",
    label: "Client success matrix",
    hint: "Also under Coaches hub tabs",
  },
  {
    href: "/admin/cash-flow-forecast",
    label: "13-week cash flow forecast",
    hint: "Zander only — projected subscriptions & payment plans",
  },
];
