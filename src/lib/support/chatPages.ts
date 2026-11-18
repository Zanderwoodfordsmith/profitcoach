import { BLUEPRINT_PAGES } from "@/lib/practiceKnowledge/blueprint";

/**
 * The places in the app a Support chat can be about (5 Nov), so the coach gets
 * one button to open it beside the chat. A fixed list: the AI picks from it
 * and BCA picks from it, so a link can't point nowhere.
 */
export type ChatPage = {
  path: string;
  /** Where it sits, for the picker: My Blueprint, Settings, the app. */
  group: "My Blueprint" | "Settings" | "The app";
  name: string;
  /** The button beside the chat's X. */
  button: string;
  /** What's there, for the AI. */
  about: string;
};

const BLUEPRINT_ABOUT: Record<string, string> = {
  about: "the coach's own story, results, voice, hours and practice set-up; the one page they fill in",
  market: "who the coach helps: ideal client, market, niche",
  linkedin: "the coach's LinkedIn profile wording: headline, About, banner",
  campaigns: "the LinkedIn campaign messages BCA writes for the coach: connection notes, follow-ups, angle",
  content: "LinkedIn posts and newsletter plan",
  offer: "the coach's offer, price, packages",
  sales: "the personalised pitch for sales calls",
};

export const CHAT_PAGES: ChatPage[] = [
  ...BLUEPRINT_PAGES.filter((page) => BLUEPRINT_ABOUT[page.slug]).map(
    (page): ChatPage => ({
      path: page.href,
      group: "My Blueprint",
      name: page.title,
      button: `Open ${page.title} page`,
      about: `My Blueprint page: ${BLUEPRINT_ABOUT[page.slug]}`,
    })
  ),
  {
    path: "/coach/settings?tab=integrations",
    group: "Settings",
    name: "Integrations",
    button: "Open Integrations",
    about: "Settings → Integrations: connect LinkedIn, email and calendar accounts",
  },
  {
    path: "/coach/settings?tab=profile",
    group: "Settings",
    name: "Your profile",
    button: "Open your profile",
    about: "Settings → Profile: name, email address, password, photo",
  },
  {
    path: "/coach/settings?tab=billing",
    group: "Settings",
    name: "Billing",
    button: "Open Billing",
    about: "Settings → Billing: card, invoices, payments",
  },
  { path: "/coach/membership", group: "The app", name: "Membership", button: "Open Membership", about: "membership plans, upgrading, what each plan includes" },
  { path: "/coach/campaigns", group: "The app", name: "Campaigns", button: "Open Campaigns", about: "running LinkedIn campaigns: sending, pausing, results" },
  { path: "/coach/prospects", group: "The app", name: "Prospects", button: "Open Prospects", about: "the prospect and lead list, importing from Sales Navigator" },
  { path: "/coach/conversations", group: "The app", name: "Conversations", button: "Open Conversations", about: "LinkedIn replies and conversations with prospects" },
  { path: "/coach/calls", group: "The app", name: "Calls", button: "Open Calls", about: "booked calls with prospects, booking page" },
  { path: "/coach/script", group: "The app", name: "Scripts", button: "Open Scripts", about: "sales call scripts and the call simulator" },
  { path: "/coach/linkedin", group: "The app", name: "Content", button: "Open Content", about: "writing and scheduling LinkedIn posts" },
  { path: "/coach/clients", group: "The app", name: "Clients", button: "Open Clients", about: "the coach's clients, keeping clients" },
  { path: "/coach/academy/classroom", group: "The app", name: "Classroom", button: "Open Classroom", about: "Academy lessons and courses" },
  { path: "/coach/community", group: "The app", name: "Community", button: "Open Community", about: "community posts and members" },
  { path: "/coach/community/calendar", group: "The app", name: "Calendar", button: "Open Calendar", about: "support calls and community events" },
];

/** The listed page for a saved link, or null. */
export function chatPageFor(path: string | null | undefined): ChatPage | null {
  if (!path) return null;
  if (CONVERSATION_PATH.test(path)) {
    return {
      path,
      group: "The app",
      name: "A conversation",
      button: "Open the conversation",
      about: "one of the coach's conversations with a prospect",
    };
  }
  return CHAT_PAGES.find((page) => page.path === path) ?? null;
}

/**
 * One of the coach's conversations with a prospect (16 Nov, job 224): BCA starts
 * a chat about a reply, and the chat's button opens that conversation.
 */
const CONVERSATION_PATH = /^\/coach\/conversations\?conversation=[0-9a-f-]{36}$/i;

export function conversationChatPath(conversationId: string): string {
  return `/coach/conversations?conversation=${conversationId}`;
}

/** The conversation a chat path points at, or null. */
export function conversationIdOfChatPath(path: string | null | undefined): string | null {
  if (!path || !CONVERSATION_PATH.test(path)) return null;
  return path.split("=")[1] ?? null;
}

/** What to call the page you're on, for "New chat about …". */
export function chatPageName(path: string): string {
  const page = chatPageFor(path) ?? chatPageFor(path.split("?")[0]);
  if (!page) return "this page";
  return CONVERSATION_PATH.test(path) ? "this conversation" : page.name;
}
