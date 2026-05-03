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
    label: "Assessment",
    hint: "Default route redirects to /assessment/BCA",
  },
  {
    href: "/join",
    label: "Program join",
    hint: "Coach signup via program link",
  },
  {
    href: "/signup",
    label: "Signup",
    hint: "BOSS coach signup",
  },
  {
    href: "/admin/client-success",
    label: "Client success matrix",
    hint: "Also under Coaches hub tabs",
  },
];
