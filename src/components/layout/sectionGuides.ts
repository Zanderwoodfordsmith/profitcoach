import { BLUEPRINT_PAGES } from "@/lib/practiceKnowledge/blueprint";
import { hubTabs } from "./sectionGuideTabs";
import { TOOLS_HUB_TAB_DETAIL, toolsHubPitch, type ToolsHubKey } from "./toolsHubPitch";

/**
 * Every area with a guide behind the (i) by its title: what the area is for,
 * then one card per tab. Areas in the same `group` run on into each other
 * (Get Calls, then Win Clients, then Keep Clients).
 */
export type GuideTabDef = {
  label: string;
  detail: string;
  /** How to find the tab on screen. Clicked to open it. */
  anchor: string;
  /** Where to go when the tab isn't on screen (another area). */
  href?: string;
};

export type SectionGuide = {
  key: string;
  title: string;
  headline: string;
  body: string;
  group?: string;
  tabs: (prefix: "/coach" | "/admin") => GuideTabDef[];
};

/** A tab in the title bar, by its name or (for button tabs) its id. */
export function headerTab(label: string, id?: string): string {
  const byLabel = `[data-page-header] [data-tab-label="${label}"]`;
  return id ? `${byLabel}, [data-page-header] [data-tab-id="${id}"]` : byLabel;
}

function clientEngine(title: string, hub: ToolsHubKey): SectionGuide {
  const pitch = toolsHubPitch(title)!;
  return {
    key: hub,
    title,
    headline: pitch.headline,
    body: pitch.body,
    group: "client-engine",
    tabs: (prefix) =>
      hubTabs(hub, prefix).map((tab) => ({
        label: tab.label,
        detail: TOOLS_HUB_TAB_DETAIL[tab.label] ?? tab.description ?? "",
        anchor: headerTab(tab.label),
        href: tab.href,
      })),
  };
}

const BLUEPRINT_DETAIL: Record<string, string> = {
  command: "Your next best action, and how far each part of your plan has got.",
  about: "The one page you fill in: your story, your skills and your goals. Everything else is built from it.",
  market: "Know exactly who you're built to help, so every message lands with the right owners.",
  linkedin: "Look credible before someone replies. Your headline and About section, written for your ideal client.",
  lists: "Who we reach out to for you: the kind of owners, where they are and how big their business is.",
  campaigns: "The messages that start conversations, written so they repeat week after week.",
  content: "Posts that keep you in front of your network between campaigns.",
  offer: "What you sell and what it costs. Make the destination clear, then make it easy to buy.",
  sales: "Know exactly what to say when an owner is interested, using their own words back to them.",
};

export const SECTION_GUIDES: SectionGuide[] = [
  {
    key: "academy",
    title: "Academy",
    headline: "Learn the method and grow with other coaches.",
    body: "The programme step by step, live calls, ready-made templates, and other coaches to ask when you're stuck. Everything you need to learn lives here.",
    tabs: (prefix) => [
      {
        label: "Community",
        detail: "Posts, wins and questions from other coaches. Share a win, ask for help, and see what's working for others right now.",
        anchor: headerTab("Community"),
        href: `${prefix}/community`,
      },
      {
        label: "Classroom",
        detail: "The programme, lesson by lesson, with the Vault of extra courses at the bottom. Follow it in order and you always know your next step.",
        anchor: headerTab("Classroom"),
        href: `${prefix}/academy/classroom`,
      },
      {
        label: "Calendar",
        detail: "Live calls with the team and other coaches, plus recordings of past ones. Come with a question, leave with an answer.",
        anchor: headerTab("Calendar"),
        href: `${prefix}/community/calendar`,
      },
      {
        label: "Resources",
        detail: "Templates, sheets and guides you can use straight away, so you never start from a blank page.",
        anchor: headerTab("Resources"),
        href: `${prefix}/academy/resources`,
      },
    ],
  },
  {
    key: "blueprint",
    title: "My Blueprint",
    headline: "Your practice plan, built for you.",
    body: "You fill in About You and BCA builds the rest: who you help, your LinkedIn profile, lead lists, campaigns, content, offer and pitch. Each page feeds the tools in Get Calls and Win Clients.",
    tabs: (prefix) =>
      BLUEPRINT_PAGES.map((page) => ({
        label: page.title,
        detail: BLUEPRINT_DETAIL[page.slug] ?? page.heading ?? "",
        anchor: `nav[aria-label="Practice blueprint"] a[data-hint-label="${page.title}"]`,
        href: prefix === "/coach" ? page.href : undefined,
      })),
  },
  clientEngine("Get Calls", "get-calls"),
  clientEngine("Win Clients", "win-clients"),
  clientEngine("Keep Clients", "keep-clients"),
  {
    key: "support",
    title: "Support",
    headline: "Help when you need it.",
    body: "Chat with the BCA team about anything, or find a quick answer in Help.",
    tabs: (prefix) =>
      prefix === "/admin"
        ? [
            { label: "Inbox", detail: "Every coach's chats, with the ones waiting on us first.", anchor: headerTab("Inbox", "inbox") },
            { label: "Help", detail: "The same answers coaches see in Help, so you can check what they read.", anchor: headerTab("Help", "help") },
            { label: "Dashboard", detail: "How fast we reply and what coaches ask about most.", anchor: headerTab("Dashboard", "dashboard") },
            { label: "Settings", detail: "Settings for Support, like the channels coaches can reach us on.", anchor: headerTab("Settings", "settings") },
          ]
        : [
            {
              label: "Chats",
              detail: "Message the BCA team about anything. Your chats stay here, so you can pick up where you left off.",
              anchor: headerTab("Chats"),
              href: "/coach/support",
            },
            {
              label: "Help",
              detail: "Quick answers to common questions, with steps and links. Search it first and you may not need to wait for a reply.",
              anchor: headerTab("Help"),
              href: "/coach/support?tab=help",
            },
          ],
  },
  {
    key: "settings",
    title: "Settings",
    headline: "Your account, in one place.",
    body: "Your profile, your plan and your targets. Keep your profile up to date, because other coaches and owners see it.",
    tabs: (prefix) => {
      const base = prefix === "/admin" ? "/admin/account" : "/coach/settings";
      return [
        {
          label: "Profile",
          detail: "Your name, photo, bio and links. This is what other coaches and owners see.",
          anchor: headerTab("Profile", "profile"),
          href: `${base}?tab=profile`,
        },
        ...(prefix === "/coach"
          ? [
              {
                label: "Billing",
                detail: "Your plan, payment card and invoices.",
                anchor: headerTab("Billing", "billing"),
                href: `${base}?tab=billing`,
              },
            ]
          : []),
        {
          label: "My Ladder",
          detail: "Your targets: how often you want to sign a client and how many leads it takes to get a call. You can show your ladder number on your profile.",
          anchor: headerTab("My Ladder", "ladder"),
          href: `${base}?tab=ladder`,
        },
      ];
    },
  },
];

export function sectionGuide(title: unknown): SectionGuide | null {
  return typeof title === "string" ? SECTION_GUIDES.find((g) => g.title === title) ?? null : null;
}
