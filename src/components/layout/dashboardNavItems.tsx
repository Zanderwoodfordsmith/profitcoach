import type React from "react";
import {
  FileDown,
  GraduationCap,
  Handshake,
  LayoutGrid,
  Library,
  Map as MapIcon,
  Newspaper,
  Palette,
  PhoneCall,
  Rocket,
  UserPlus,
  Wallet,
  Wrench,
} from "lucide-react";
import type { CoachFeature } from "@/lib/coachAccess/tiers";
import { AvaHalo } from "@/components/ava/AvaHalo";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
  /** One plain line under the name in the sidebar hover card. */
  description?: string;
  /** When set, item is hidden unless the coach has this feature. */
  requiredFeature?: CoachFeature;
  /** Tools hub: sidebar stays active across every tab in the hub. */
  toolsHub?: "get-clients" | "coach-clients" | "blueprint";
};

export type AdminSectionNavItem = DashboardNavItem & {
  coachesHub?: boolean;
  financialsHub?: boolean;
  toolkitHub?: boolean;
  /** Roadmap + lesson import + related product tooling. */
  academyHub?: boolean;
  /** Practice Blueprint: coach view, records, and the page map. */
  blueprintHub?: boolean;
};

function IconBlueprint({ className }: { className?: string }) {
  return <MapIcon className={className} />;
}

function IconBriefcase({ className }: { className?: string }) {
  return <Handshake className={className} />;
}

function IconUserPlus({ className }: { className?: string }) {
  return <UserPlus className={className} />;
}

function IconBookOpen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-2.992.502V6H18c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 012.5 1.1V4.502A8.967 8.967 0 0018 3.75c-1.052 0-2.062.18-2.992.502A8.967 8.967 0 0012 6.042zM12 18.042a8.967 8.967 0 006-2.292c1.052 0 2.062.18 2.992.502V18H6v-1.75c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 002.5 1.1 8.967 8.967 0 006-2.292zM12 18.042a8.967 8.967 0 01-6-2.292c-1.052 0-2.062.18-2.992.502V18H18v-1.75a8.968 8.968 0 00-2.5-1.1 3.744 3.744 0 00-2.5-1.1 8.967 8.967 0 01-6 2.292z" />
    </svg>
  );
}

function IconAcademy({ className }: { className?: string }) {
  return <GraduationCap className={className} />;
}

/** Ava's Halo, sized like the other sidebar icons. */
function IconAva({ className }: { className?: string }) {
  return <AvaHalo size={20} dark className={className} />;
}

/** AI tools share Ava's Halo. */
function IconAvaTool({ className }: { className?: string }) {
  return <AvaHalo size={20} dark className={className} />;
}

function IconLessonImport({ className }: { className?: string }) {
  return <FileDown className={className} />;
}

function IconBrand({ className }: { className?: string }) {
  return <Palette className={className} />;
}

function IconBlog({ className }: { className?: string }) {
  return <Newspaper className={className} />;
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

/** Community, Classroom and Calendar share one sidebar item with tabs. */
function academyNavItem(prefix: "/coach" | "/admin"): DashboardNavItem {
  return {
    href: `${prefix}/academy/classroom`,
    label: "Academy",
    description: "Community, Classroom, Calendar and Resources",
    icon: IconAcademy,
    requiredFeature: "nav.classroom",
  };
}

/** Every page under the Academy item: the community, calendar and classroom. */
export function isAcademyPath(pathname: string | null, prefix: "/coach" | "/admin"): boolean {
  if (!pathname) return false;
  if (prefix === "/admin" && isAcademyHubPath(pathname)) return false;
  return [`${prefix}/community`, `${prefix}/academy`].some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );
}

export function mainNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  return [academyNavItem(prefix)];
}

export function filterNavItemsByFeatures(
  items: DashboardNavItem[],
  hasFeature: (feature: CoachFeature) => boolean
): DashboardNavItem[] {
  return items.filter(
    (item) => !item.requiredFeature || hasFeature(item.requiredFeature)
  );
}

/**
 * Phone bottom bar: two tabs each side of Ava. Settings and Log out sit on
 * the photo in the top bar; admin pages are in that sheet too.
 */
export function mobileTabNavItems(prefix: "/coach" | "/admin"): {
  left: DashboardNavItem[];
  right: DashboardNavItem[];
} {
  const tools = coachToolsNavItems(prefix);
  const hub = (key: DashboardNavItem["toolsHub"]) =>
    tools.filter((item) => item.toolsHub === key);
  return {
    left: [academyNavItem(prefix), ...hub("blueprint")],
    right: [...hub("get-clients"), ...hub("coach-clients")],
  };
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

function IconCampaignLibrary({ className }: { className?: string }) {
  return <Library className={className} />;
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
    items.push({
      href: `${prefix}/message-generator`,
      label: "Create",
      icon: IconAvaTool,
    });
  }
  return items;
}

/** Marketing links shown to coaches (Boss Pro, prospects, funnel — no Create hub). */
export function coachMarketingNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  return marketingNavItems(prefix, { includeBossScore: true, includeAi: false });
}

export function deliveryNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  return [
    { href: `${prefix}/clients`, label: "Clients", icon: IconBriefcase },
    { href: `${prefix}/playbooks`, label: "Playbooks", icon: IconBookOpen },
  ];
}

/**
 * Coach sidebar: Marketing + Delivery collapsed into two Tools hubs.
 * Each link opens its home on first visit; the sidebar overrides it with the
 * last page or tab from this session (see `lib/getClients/lastHubTab`).
 */
/**
 * Blueprint link at the top of Tools. Admins always see it. Released to
 * coaches on 19 Oct 2026; set this to false to hide it from them again.
 */
const SHOW_BLUEPRINT_IN_COACH_SIDEBAR = true;

export function coachToolsNavItems(prefix: "/coach" | "/admin"): DashboardNavItem[] {
  // Admins open the coach view, where they can page through every coach's blueprint.
  const blueprint: DashboardNavItem[] =
    prefix === "/admin" || SHOW_BLUEPRINT_IN_COACH_SIDEBAR
    ? [
        {
          href: prefix === "/coach" ? "/coach/blueprint" : "/admin/blueprint/coach",
          label: "My Blueprint",
          description: "Your practice plan, built from your answers",
          icon: IconBlueprint,
          toolsHub: "blueprint",
        },
      ]
    : [];
  return [
    ...blueprint,
    {
      href: `${prefix}/conversations`,
      label: "Get Clients",
      description: "Campaigns, conversations and sales calls",
      icon: IconUserPlus,
      requiredFeature: "nav.marketing",
      toolsHub: "get-clients",
    },
    {
      href: `${prefix}/clients`,
      label: "Keep Clients",
      description: "Your clients, their BOSS Scores and playbooks",
      icon: IconBriefcase,
      requiredFeature: "nav.delivery",
      toolsHub: "coach-clients",
    },
  ];
}

/** Tabs inside the Get Clients hub (former Marketing links). */
export function getClientsTabHrefs(prefix: "/coach" | "/admin"): string[] {
  return getClientsTabItems(prefix)
    .filter((item) => !item.iconOnly)
    .map((item) => item.href);
}

/** Tabs inside the Keep Clients hub (former Delivery links). */
export function coachClientsTabHrefs(prefix: "/coach" | "/admin"): string[] {
  return [
    `${prefix}/clients`,
    `${prefix}/playbooks`,
    `${prefix}/boss-pro`,
    `${prefix}/profit-levers`,
  ];
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
  /** Shown in the hover card on the tab. */
  description?: string;
  /** Gear-only tab at the end of the Get Clients hub. */
  iconOnly?: boolean;
  /**
   * Not released to coaches yet. Shown only for admins on the admin surface
   * (subtle/grey + lock). Coaches and admins “View as coach” never see these
   * tabs; direct /coach URLs redirect away.
   */
  adminPreview?: boolean;
};

export type CoachClientsTabItem = {
  href: string;
  label: string;
  description?: string;
  /** Stable key for active-state matching */
  key: string;
  adminPreview?: boolean;
};

/**
 * Get Clients peer tabs — Classroom Get Calls order:
 * Campaigns generate conversations, conversations book calls. Scripts sit
 * beside Calls, where they're used; Prospects is a list to look things up in.
 * Campaigns → Conversations → Calls → Scripts → Prospects → Content → Toolkit
 * Create tools live in Profit Coach AI (fullscreen Create tab).
 *
 * Toolkit holds Links (`/share`, its first sub-tab, so it does not collide
 * with the admin page at `/admin/links`) and the brochure and graphics
 * (`/toolkit`). See {@link isGetClientsToolkitPath}.
 */
export function getClientsTabItems(prefix: "/coach" | "/admin"): ToolsHubTabItem[] {
  // Today is hidden from coaches while it's redesigned; admins find it under Tools and links.
  const items: ToolsHubTabItem[] = [
    {
      href: `${prefix}/campaigns`,
      label: "Campaigns",
      description: "LinkedIn campaigns that start conversations",
    },
    {
      href: `${prefix}/conversations`,
      label: "Conversations",
      description: "Your messages from LinkedIn, WhatsApp and email",
    },
    {
      href: `${prefix}/calls`,
      label: "Calls",
      description: "Sales calls booked in your calendar",
    },
    {
      href: `${prefix}/script`,
      label: "Scripts",
      description: "Every script for your calls with owners",
    },
    {
      href: `${prefix}/prospects`,
      label: "Prospects",
      description: "People you've added or who took your BOSS Score",
    },
  ];
  items.push({
    href: prefix === "/admin" ? "/admin/linkedin" : "/coach/linkedin",
    label: "Content",
    description: "Plan and write your LinkedIn posts",
  });
  items.push({
    href: `${prefix}/share`,
    label: "Toolkit",
    description: "Your links, brochure and ready-made graphics",
  });
  return items;
}

/** Paths that belong to Get Clients (tabs + Create / Content satellites). */
export function getClientsHubPaths(prefix: "/coach" | "/admin"): string[] {
  const paths = [
    ...getClientsTabHrefs(prefix),
    `${prefix}/funnel-settings`,
    `${prefix}/first-campaign`,
    `${prefix}/ideal-client`,
    `${prefix}/message-generator`,
    `${prefix}/linkedin-profile`,
    `${prefix}/campaigns`,
    `${prefix}/lead-magnets`,
    `${prefix}/pipeline`,
    `${prefix}/linkedin`,
    `${prefix}/share`,
    `${prefix}/toolkit`,
  ];
  if (prefix === "/coach") {
    paths.push("/coach/links");
  }
  if (prefix === "/admin") {
    paths.push(
      "/admin/lead-finder",
      "/admin/linkedin",
      "/admin/newsletter"
    );
  }
  return Array.from(new Set(paths));
}

/** Content tab is the LinkedIn planner. */
export function isGetClientsContentPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathMatches(pathname, "/admin/linkedin") ||
    pathMatches(pathname, "/coach/linkedin")
  );
}

/** Toolkit tab covers Links (`/share`) and the brochure and graphics (`/toolkit`). */
export function isGetClientsToolkitPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathMatches(pathname, "/admin/share") ||
    pathMatches(pathname, "/coach/share") ||
    pathMatches(pathname, "/admin/toolkit") ||
    pathMatches(pathname, "/coach/toolkit")
  );
}

/** Create tab stays active on writers / setup tools (not Content). */
export function isGetClientsCreatePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathMatches(pathname, "/coach/message-generator") ||
    pathMatches(pathname, "/admin/message-generator") ||
    pathMatches(pathname, "/admin/newsletter") ||
    pathMatches(pathname, "/coach/first-campaign") ||
    pathMatches(pathname, "/admin/first-campaign") ||
    pathMatches(pathname, "/coach/ideal-client") ||
    pathMatches(pathname, "/admin/ideal-client") ||
    pathMatches(pathname, "/coach/linkedin-profile") ||
    pathMatches(pathname, "/admin/linkedin-profile") ||
    pathMatches(pathname, "/admin/lead-finder")
  );
}

/** @deprecated Use isGetClientsCreatePath */
export function isGetClientsStudioPath(pathname: string | null): boolean {
  return isGetClientsCreatePath(pathname);
}

/**
 * Keep Clients hub tabs only. Per-client tools (plans, notes, …) live on the
 * individual client workspace, not here.
 */
export function coachClientsTabItems(
  prefix: "/coach" | "/admin"
): CoachClientsTabItem[] {
  return [
    {
      key: "clients",
      href: `${prefix}/clients`,
      label: "Clients",
      description: "Everyone you coach, with price and join date",
    },
    {
      key: "boss-pro",
      href: `${prefix}/boss-pro`,
      label: "BOSS Score",
      description: "Your clients' BOSS Scores and reports",
    },
    {
      key: "playbooks",
      href: `${prefix}/playbooks`,
      label: "Playbooks",
      description: "Guides to share with clients, with your link added",
    },
    {
      key: "profit-levers",
      href: `${prefix}/profit-levers`,
      label: "Profit levers",
      description: "What small moves on six numbers are worth",
      adminPreview: true,
    },
    {
      key: "simulator",
      href: `${prefix}/simulator`,
      label: "Client simulator",
      description: "Practise out loud with AI clients and get a score",
    },
  ];
}

const CLIENT_ID_PATH =
  /^\/(coach|admin)\/clients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function coachClientsTabActive(
  pathname: string | null,
  _search: string | null,
  tabKey: string
): boolean {
  if (!pathname) return false;

  if (tabKey === "clients") {
    return (
      pathname === "/coach/clients" ||
      pathname === "/admin/clients" ||
      pathname === "/coach/clients/coaching" ||
      pathname === "/admin/clients/coaching" ||
      CLIENT_ID_PATH.test(pathname)
    );
  }
  if (tabKey === "playbooks") {
    return (
      pathname === "/coach/playbooks" ||
      pathname === "/admin/playbooks" ||
      Boolean(pathname.startsWith("/coach/playbooks/")) ||
      Boolean(pathname.startsWith("/admin/playbooks/"))
    );
  }
  if (tabKey === "profit-levers") {
    return pathname === "/coach/profit-levers" || pathname === "/admin/profit-levers";
  }
  if (tabKey === "simulator") {
    return /^\/(coach|admin)\/simulator(\/|$)/.test(pathname);
  }
  if (tabKey === "boss-pro") {
    return (
      pathname === "/coach/boss-pro" ||
      pathname === "/admin/boss-pro" ||
      Boolean(pathname.startsWith("/coach/boss-pro/")) ||
      Boolean(pathname.startsWith("/admin/boss-pro/"))
    );
  }

  return false;
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
    href: "/admin/roadmap",
    label: "Product",
    icon: IconLessonImport,
    academyHub: true,
  },
  {
    href: "/admin/brand",
    label: "Brand",
    icon: IconBrand,
  },
  {
    href: "/admin/ava",
    label: "Ava",
    icon: IconAva,
  },
  {
    href: "/admin/campaign-library",
    label: "Campaign library",
    icon: IconCampaignLibrary,
  },
  {
    href: "/admin/blog",
    label: "Blog",
    icon: IconBlog,
  },
  {
    href: "/admin/links",
    label: "Tools and links",
    icon: IconSiteTools,
    toolkitHub: true,
  },
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
    pathMatches(pathname, "/admin/client-success")
  );
}

export function isBlueprintHubPath(pathname: string | null): boolean {
  return (
    pathMatches(pathname, "/admin/blueprint") ||
    pathMatches(pathname, "/admin/practice")
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
    pathMatches(pathname, "/admin/signature") ||
    pathMatches(pathname, "/admin/time-tracker") ||
    pathMatches(pathname, "/admin/landing-analytics") ||
    pathMatches(pathname, "/admin/funnel-analyzer") ||
    pathMatches(pathname, "/admin/sales-nav-imports") ||
    pathMatches(pathname, "/admin/referrals") ||
    pathMatches(pathname, "/admin/today")
  );
}

export function isAcademyHubPath(pathname: string | null): boolean {
  return (
    pathMatches(pathname, "/admin/roadmap") ||
    pathMatches(pathname, "/admin/lesson-import") ||
    pathMatches(pathname, "/admin/growth-system") ||
    pathMatches(pathname, "/admin/academy/archive")
  );
}

export function adminSectionNavItemActive(
  pathname: string | null,
  item: AdminSectionNavItem
): boolean {
  if (item.coachesHub) return isCoachesHubPath(pathname);
  if (item.blueprintHub) return isBlueprintHubPath(pathname);
  if (item.financialsHub) return isFinancialsHubPath(pathname);
  if (item.toolkitHub) return isToolkitHubPath(pathname);
  if (item.academyHub) return isAcademyHubPath(pathname);
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
