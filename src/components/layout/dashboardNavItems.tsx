import type React from "react";
import {
  Archive,
  CalendarDays,
  LayoutGrid,
  MessagesSquare,
  PhoneCall,
  Rocket,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";
import type { CoachFeature } from "@/lib/coachAccess/tiers";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
  /** When set, item is hidden unless the coach has this feature. */
  requiredFeature?: CoachFeature;
};

export type AdminSectionNavItem = DashboardNavItem & {
  coachesHub?: boolean;
  financialsHub?: boolean;
  toolkitHub?: boolean;
};

function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  );
}

function IconBookOpen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-2.992.502V6H18c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 012.5 1.1V4.502A8.967 8.967 0 0018 3.75c-1.052 0-2.062.18-2.992.502A8.967 8.967 0 0012 6.042zM12 18.042a8.967 8.967 0 006-2.292c1.052 0 2.062.18 2.992.502V18H6v-1.75c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 002.5 1.1 8.967 8.967 0 006-2.292zM12 18.042a8.967 8.967 0 01-6-2.292c-1.052 0-2.062.18-2.992.502V18H18v-1.75a8.968 8.968 0 00-2.5-1.1 3.744 3.744 0 00-2.5-1.1 8.967 8.967 0 01-6 2.292z" />
    </svg>
  );
}

function IconAcademy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l7-3.5L12 7 5 10.5 12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5V16.5l7 3.5 7-3.5v-6M5 16.5l7 3.5 7-3.5" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return <CalendarDays className={className} />;
}

function IconSparkles({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}

function IconMessagesSquare({ className }: { className?: string }) {
  return <MessagesSquare className={className} />;
}

function IconArchive({ className }: { className?: string }) {
  return <Archive className={className} />;
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconWorkshop({ className }: { className?: string }) {
  return <LayoutGrid className={className} />;
}

export function mainNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  const base: DashboardNavItem[] = [
    {
      href: `${prefix}/community`,
      label: "Community",
      icon: IconMessagesSquare,
      requiredFeature: "community.feed",
    },
  ];
  base.push(
    {
      href: `${prefix}/academy`,
      label: "Classroom",
      icon: IconAcademy,
      requiredFeature: "nav.classroom",
    },
    {
      href: `${prefix}/community/calendar`,
      label: "Calendar",
      icon: IconCalendar,
      requiredFeature: "calendar.momentum_only",
    }
  );
  return base;
}

export function filterNavItemsByFeatures(
  items: DashboardNavItem[],
  hasFeature: (feature: CoachFeature) => boolean
): DashboardNavItem[] {
  return items.filter(
    (item) => !item.requiredFeature || hasFeature(item.requiredFeature)
  );
}

/** Primary tabs on mobile (Boss Pro and admin tools live under More). */
export function mobilePrimaryNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  const items: DashboardNavItem[] = [
    {
      href: `${prefix}/community`,
      label: "Community",
      icon: IconMessagesSquare,
      requiredFeature: "community.feed",
    },
    {
      href: `${prefix}/academy`,
      label: "Classroom",
      icon: IconAcademy,
      requiredFeature: "nav.classroom",
    },
    {
      href: `${prefix}/community/calendar`,
      label: "Calendar",
      icon: IconCalendar,
      requiredFeature: "calendar.momentum_only",
    },
  ];
  return items;
}

export function mobileMoreNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  return [bossScoreNavItem(prefix)];
}

function bossScoreNavItem(prefix: "/coach" | "/admin"): DashboardNavItem {
  return { href: `${prefix}/boss-pro`, label: "Boss Pro", icon: IconWorkshop };
}

function callsNavItem(prefix: "/coach" | "/admin"): DashboardNavItem {
  return { href: `${prefix}/calls`, label: "Calls", icon: IconPhoneCall };
}

function IconPhoneCall({ className }: { className?: string }) {
  return <PhoneCall className={className} />;
}

function IconWallet({ className }: { className?: string }) {
  return <Wallet className={className} />;
}

function IconSiteTools({ className }: { className?: string }) {
  return <Wrench className={className} />;
}

function IconRocket({ className }: { className?: string }) {
  return <Rocket className={className} />;
}

export type MarketingNavOptions = {
  includeBossScore?: boolean;
  /** When false, omits the message-generator link (coach sidebar). Default true. */
  includeAi?: boolean;
};

export function marketingNavItems(
  prefix: "/coach" | "/admin",
  options?: MarketingNavOptions
): DashboardNavItem[] {
  const items: DashboardNavItem[] = [
    { href: `${prefix}/first-campaign`, label: "First Campaign", icon: IconRocket },
    { href: `${prefix}/prospects`, label: "Prospects", icon: IconUserPlus },
    callsNavItem(prefix),
  ];
  if (options?.includeBossScore) {
    items.push(bossScoreNavItem(prefix));
  }
  if (options?.includeAi !== false) {
    items.push({ href: `${prefix}/message-generator`, label: "AI", icon: IconSparkles });
  }
  return items;
}

/** Marketing links shown to coaches (Boss Pro, prospects, funnel — no AI). */
export function coachMarketingNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  return marketingNavItems(prefix, { includeBossScore: true, includeAi: false });
}

export function deliveryNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  return [
    { href: `${prefix}/clients`, label: "Clients", icon: IconBriefcase },
    { href: `${prefix}/playbooks`, label: "Playbooks", icon: IconBookOpen },
  ];
}

/** Coach sidebar: Marketing + Delivery collapsed into two Tools hubs. */
export function coachToolsNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  return [
    {
      href: `${prefix}/prospects`,
      label: "Get Clients",
      icon: IconUserPlus,
      requiredFeature: "nav.marketing",
    },
    {
      href: `${prefix}/clients`,
      label: "Coach Clients",
      icon: IconBriefcase,
      requiredFeature: "nav.delivery",
    },
  ];
}

/** Tabs inside the Get Clients hub (former Marketing links). */
export function getClientsTabHrefs(prefix: "/coach" | "/admin"): string[] {
  return getClientsTabItems(prefix).map((item) => item.href);
}

/** Tabs inside the Coach Clients hub (former Delivery links). */
export function coachClientsTabHrefs(prefix: "/coach" | "/admin"): string[] {
  return [`${prefix}/clients`, `${prefix}/playbooks`];
}

export function isToolsHubPath(
  pathname: string | null,
  hrefs: string[]
): boolean {
  if (!pathname) return false;
  return hrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}

export type ToolsHubTabItem = {
  href: string;
  label: string;
  /** Gear-only tab at the end of the Get Clients hub. */
  iconOnly?: boolean;
  /**
   * Not released to coaches yet. Shown only for admins (subtle/grey + lock).
   * Coaches never see these tabs; direct /coach URLs redirect away.
   */
  adminPreview?: boolean;
};

export type CoachClientsTabItem = {
  href: string;
  label: string;
  /** Stable key for active-state matching */
  key: string;
  adminPreview?: boolean;
};

export function getClientsTabItems(prefix: "/coach" | "/admin"): ToolsHubTabItem[] {
  /** Funnel order: Prospects → Pipeline → Calls stay clustered. */
  const items: ToolsHubTabItem[] = [
    {
      href: `${prefix}/first-campaign`,
      label: "First Campaign",
      adminPreview: true,
    },
  ];
  if (prefix === "/admin") {
    items.push({
      href: "/admin/lead-finder",
      label: "Lead Finder",
      adminPreview: true,
    });
  }
  items.push(
    { href: `${prefix}/prospects`, label: "Prospects" },
    { href: `${prefix}/pipeline`, label: "Pipeline", adminPreview: true },
    { href: `${prefix}/calls`, label: "Calls" },
    { href: `${prefix}/boss-pro`, label: "Boss Pro" }
  );
  if (prefix === "/admin") {
    items.push({
      href: "/admin/linkedin",
      label: "Content planner",
      adminPreview: true,
    });
    items.push({
      href: "/admin/newsletter",
      label: "Newsletter",
      adminPreview: true,
    });
    items.push({
      href: `${prefix}/message-generator`,
      label: "AI",
      adminPreview: true,
    });
  }
  items.push({
    href: `${prefix}/funnel-settings`,
    label: "Settings",
    iconOnly: true,
  });
  return items;
}

export function coachClientsTabItems(
  prefix: "/coach" | "/admin",
  options?: { contactId?: string | null }
): CoachClientsTabItem[] {
  const contactId = options?.contactId ?? null;
  const toolHref = (tab: string) => {
    if (contactId) {
      const path = `${prefix}/clients/${encodeURIComponent(contactId)}`;
      if (!tab || tab === "overview") return path;
      return `${path}?tab=${encodeURIComponent(tab)}`;
    }
    const path = `${prefix}/clients/coaching`;
    if (!tab || tab === "overview") return path;
    return `${path}?tab=${encodeURIComponent(tab)}`;
  };

  return [
    { key: "clients", href: `${prefix}/clients`, label: "Clients" },
    { key: "playbooks", href: `${prefix}/playbooks`, label: "Playbooks" },
    {
      key: "overview",
      href: toolHref("overview"),
      label: "Overview",
      adminPreview: true,
    },
    {
      key: "plan",
      href: toolHref("plan"),
      label: "3-Year Plan",
      adminPreview: true,
    },
    {
      key: "ninety-day",
      href: toolHref("ninety-day"),
      label: "90-Day",
      adminPreview: true,
    },
    {
      key: "revenue",
      href: toolHref("revenue"),
      label: "Revenue",
      adminPreview: true,
    },
    {
      key: "expenses",
      href: toolHref("expenses"),
      label: "Expenses",
      adminPreview: true,
    },
    {
      key: "team",
      href: toolHref("team"),
      label: "Team",
      adminPreview: true,
    },
    {
      key: "notes",
      href: toolHref("notes"),
      label: "Notes",
      adminPreview: true,
    },
  ];
}

const CLIENT_ID_PATH =
  /^\/(coach|admin)\/clients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function coachClientsTabActive(
  pathname: string | null,
  search: string | null,
  tabKey: string
): boolean {
  if (!pathname) return false;
  const raw = search?.startsWith("?") ? search.slice(1) : search ?? "";
  const params = new URLSearchParams(raw);
  const tabParam = params.get("tab") || "overview";

  if (tabKey === "clients") {
    return pathname === "/coach/clients" || pathname === "/admin/clients";
  }
  if (tabKey === "playbooks") {
    return (
      pathname === "/coach/playbooks" ||
      pathname === "/admin/playbooks" ||
      Boolean(pathname.startsWith("/coach/playbooks/")) ||
      Boolean(pathname.startsWith("/admin/playbooks/"))
    );
  }

  const onCoachingHub =
    pathname === "/coach/clients/coaching" ||
    pathname === "/admin/clients/coaching";
  const onClientWorkspace = CLIENT_ID_PATH.test(pathname);

  if (!onCoachingHub && !onClientWorkspace) return false;
  if (tabKey === "overview") return !params.get("tab") || tabParam === "overview";
  return tabParam === tabKey;
}

export const adminSectionNavItems: AdminSectionNavItem[] = [
  { href: "/admin", label: "Coaches", icon: IconUsers, coachesHub: true },
  {
    href: "/admin/payments",
    label: "Financials",
    icon: IconWallet,
    financialsHub: true,
  },
  {
    href: "/admin/links",
    label: "Tools and links",
    icon: IconSiteTools,
    toolkitHub: true,
  },
  {
    href: "/admin/academy/archive",
    label: "Archive",
    icon: IconArchive,
  },
  { href: "/admin/community/feedback", label: "Inbox", icon: IconMessagesSquare },
];

function pathMatches(pathname: string | null, href: string): boolean {
  return Boolean(
    pathname === href || pathname?.startsWith(`${href}/`)
  );
}

export function isCoachesHubPath(pathname: string | null): boolean {
  return (
    pathname === "/admin" ||
    pathname === "/admin/" ||
    pathMatches(pathname, "/admin/coaches") ||
    pathMatches(pathname, "/admin/client-success") ||
    pathMatches(pathname, "/admin/action-plans") ||
    pathMatches(pathname, "/admin/coach-groups")
  );
}

export function isFinancialsHubPath(pathname: string | null): boolean {
  return (
    pathMatches(pathname, "/admin/payments") ||
    pathMatches(pathname, "/admin/cash-flow-forecast")
  );
}

export function isToolkitHubPath(pathname: string | null): boolean {
  return (
    pathMatches(pathname, "/admin/links") ||
    pathMatches(pathname, "/admin/settings") ||
    pathMatches(pathname, "/admin/signature/scorecard") ||
    pathMatches(pathname, "/admin/time-tracker") ||
    pathMatches(pathname, "/admin/landing-analytics") ||
    pathMatches(pathname, "/admin/lesson-import") ||
    pathMatches(pathname, "/admin/funnel-analyzer")
  );
}

export function adminSectionNavItemActive(
  pathname: string | null,
  item: AdminSectionNavItem
): boolean {
  if (item.coachesHub) return isCoachesHubPath(pathname);
  if (item.financialsHub) return isFinancialsHubPath(pathname);
  if (item.toolkitHub) return isToolkitHubPath(pathname);
  return navLinkActive(pathname, item.href);
}

export function navLinkActive(pathname: string | null, href: string, coachesHub?: boolean) {
  if (coachesHub) return isCoachesHubPath(pathname);
  const pathOnly = href.split("?")[0] ?? href;
  const root = pathOnly.split("/").slice(0, 2).join("/");
  return (
    pathname === pathOnly ||
    (pathOnly !== root && Boolean(pathname?.startsWith(`${pathOnly}/`)))
  );
}

export function mobileNavShortLabel(label: string): string {
  return label;
}
