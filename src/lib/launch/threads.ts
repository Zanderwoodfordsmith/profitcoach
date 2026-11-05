import { BLUEPRINT_GROUPS, sectionByKey, sectionKey } from "@/lib/practiceKnowledge/blueprint";
import type { GettingLiveStepKey } from "@/lib/gettingLiveSteps";
import type { SupportTicketType } from "@/lib/support/tickets";

/**
 * The pinned threads in every coach's channel, like the project threads we
 * pinned in each coach's Slack channel. They are the same items as the coach's
 * launch roadmap (job 172), so talk about the LinkedIn profile sits on the
 * LinkedIn profile job. Stored as community_feedback_reports.topic, one per
 * coach per thread, made when the thread is started.
 */
export type LaunchPhaseKey = "get" | "calls" | "win" | "keep";

/** Launch ends at the connection campaign; then calls, then clients (Zander, 2 Nov). */
export const LAUNCH_PHASES: { key: LaunchPhaseKey; label: string }[] = [
  { key: "get", label: "Phase 1 · Launch" },
  { key: "calls", label: "Phase 2 · Get calls" },
  { key: "win", label: "Phase 3 · Get clients" },
  { key: "keep", label: "Phase 4 · Keep clients" },
];

export type LaunchThread = {
  key: string;
  label: string;
  /** Null for Help & support, which sits above the phases. */
  phase: LaunchPhaseKey | null;
  /** One line at the top of the open thread: what it's for. */
  hint: string;
  type: SupportTicketType;
  /** Jobs only: the brief at the top of the thread, written to the coach. */
  brief?: { what: string; need: string };
  /** The Blueprint page where the coach does this job, for the "Open in your Blueprint" button. */
  blueprintPage?: string;
  /** A short explainer video for the brief, once one is made. */
  videoUrl?: string;
  /** Worth doing, not needed: left out of the done counts. */
  optional?: boolean;
};

export const LAUNCH_THREADS: LaunchThread[] = [
  {
    key: "help",
    label: "Help & support",
    phase: null,
    hint: "Anything that isn't about one of the projects below.",
    type: "question",
  },
  {
    key: "about-you",
    label: "About you",
    phase: "get",
    hint: "Your story, results and how you sound, so everything we write sounds like you.",
    type: "question",
    brief: {
      what: "This is where we get to know you: your story, your results and how you talk. Everything we write for you starts here.",
      need: "Talk to Ava about you, or fill in your About You page. It takes about 30 minutes.",
    },
    blueprintPage: "about",
  },
  {
    key: "ideal-client",
    label: "Ideal client",
    phase: "get",
    hint: "Who you help, what keeps them up at night, and the market you go after.",
    type: "question",
    brief: {
      what: "Who you help and what keeps them up at night. It shapes every message we write for you.",
      need: "Read what we write about your ideal client and tell us anything that feels off.",
    },
    blueprintPage: "market",
  },
  {
    key: "linkedin-profile",
    label: "LinkedIn profile",
    phase: "get",
    hint: "Your headline, About, banner and putting it live.",
    type: "question",
    brief: {
      what: "We rewrite your headline, About section and banner so the right owners see why they should talk to you.",
      need: "Check your new profile, then put it live on LinkedIn. It takes about 10 minutes.",
    },
    blueprintPage: "linkedin",
  },
  {
    key: "lead-list",
    label: "Lead list",
    phase: "get",
    hint: "The 1,000 people your campaign goes to.",
    type: "question",
    brief: {
      what: "We find the business owners your campaign goes to.",
      need: "Nothing yet. We show you the list to check before anything goes out.",
    },
  },
  {
    key: "connection-campaign",
    label: "Connection campaign",
    phase: "get",
    hint: "Your connection note, follow-ups and going live.",
    type: "question",
    brief: {
      what: "Your connection note and follow-up messages. We write them, you agree them, then we press go.",
      need: "Read the messages and say yes, or ask for changes here.",
    },
    blueprintPage: "campaigns",
  },
  {
    key: "content",
    label: "Content and newsletter",
    phase: "calls",
    hint: "Your posts and newsletter.",
    type: "question",
    brief: {
      what: "Your posts and newsletter, so people who see your name know what you do.",
      need: "Check the posts we write and tell us anything that doesn\u2019t sound like you.",
    },
    blueprintPage: "content",
  },
  {
    key: "reactivation",
    label: "Reactivation campaign",
    phase: "calls",
    hint: "Messages to people you already know, to restart the conversation.",
    type: "question",
    brief: {
      what: "Three short messages to people you already know: old colleagues, past clients and contacts. They restart the conversation, with no pitch.",
      need: "Add the first line for each person, then say yes or ask for changes here.",
    },
    blueprintPage: "campaigns",
  },
  {
    key: "existing-connections",
    label: "Existing connections",
    phase: "calls",
    hint: "Messages to people you're connected with but haven't spoken to yet.",
    type: "question",
    brief: {
      what: "Four short messages to people you're already connected with on LinkedIn but have never spoken to. They start a chat and offer the free BOSS Score.",
      need: "Read the messages and say yes, or ask for changes here.",
    },
    blueprintPage: "campaigns",
    optional: true,
  },
  {
    key: "replies-follow-up",
    label: "Replies and follow-up",
    phase: "calls",
    hint: "What to say when people reply, and following up.",
    type: "question",
    brief: {
      what: "What to say when people reply, and how to follow up so good chats turn into calls.",
      need: "Post here when someone replies and you\u2019re not sure what to say.",
    },
  },
  {
    key: "sales-calls",
    label: "Sales calls",
    phase: "win",
    hint: "Your first calls, the pitch and closing.",
    type: "question",
    brief: {
      what: "Your offer, your pitch and how to run your first calls.",
      need: "Check your offer and pitch, and practise a call before your first real one.",
    },
    blueprintPage: "offer",
  },
  {
    key: "client-onboarding",
    label: "Client onboarding",
    phase: "keep",
    hint: "Agreement, welcome pack and getting a new client started.",
    type: "question",
    brief: {
      what: "What happens when someone says yes: the agreement, the welcome pack and the first session.",
      need: "Nothing yet. This starts when you win your first client.",
    },
  },
  {
    key: "coaching-sessions",
    label: "Coaching sessions",
    phase: "keep",
    hint: "Running your sessions and keeping clients.",
    type: "question",
    brief: {
      what: "Running your sessions and keeping clients happy month after month.",
      need: "Ask anything here once you\u2019re coaching clients.",
    },
  },
];

export function launchThread(key: string | null | undefined): LaunchThread | null {
  if (!key) return null;
  return LAUNCH_THREADS.find((thread) => thread.key === key) ?? null;
}

/** Which thread a Blueprint page's comments belong to. Anything else goes to Help. */
export const BLUEPRINT_PAGE_THREAD: Record<string, string> = {
  about: "about-you",
  market: "ideal-client",
  linkedin: "linkedin-profile",
  campaigns: "connection-campaign",
  content: "content",
  offer: "sales-calls",
  sales: "sales-calls",
};

/**
 * Parts that are their own job though they share a page with another: the
 * three campaigns are three jobs (Zander, 2 Nov).
 */
export const SECTION_THREAD: Record<string, string> = {
  "campaigns:conversation": "existing-connections",
  "campaigns:reactivation": "reactivation",
};

/** The job a Blueprint part belongs to: its own, or its page's. */
export function threadForSectionRef(ref: { key: string; page: { slug: string } }): string | undefined {
  return SECTION_THREAD[ref.key] ?? BLUEPRINT_PAGE_THREAD[ref.page.slug];
}

/** The thread a comment on this Blueprint section ("page:id") is filed under. */
export function threadForBlueprintSection(sectionKey: string): string {
  const page = sectionByKey(sectionKey)?.page.slug ?? sectionKey.split(":")[0];
  return SECTION_THREAD[sectionKey] ?? BLUEPRINT_PAGE_THREAD[page] ?? "help";
}

/** Titles of the Blueprint pages whose comments land in this thread (none for Help, the catch-all). */
export function blueprintPagesForThread(threadKey: string): string[] {
  if (threadKey === "help") return [];
  return BLUEPRINT_GROUPS.flatMap((group) => group.pages)
    .filter((page) => page.sections.some((section) => threadForSectionRef({ key: sectionKey(page, section), page }) === threadKey))
    .map((page) => page.title);
}

/**
 * The Getting live checks each thread's job is made of, beside its Blueprint
 * pages. Blueprint call is left out: it's a call, not a piece of work.
 */
export const LAUNCH_STEP_THREAD: Partial<Record<GettingLiveStepKey, string>> = {
  about_you: "about-you",
  linkedin_updated: "linkedin-profile",
  leads_found: "lead-list",
  campaign_set_up: "connection-campaign",
  signed_off: "connection-campaign",
  campaign_live: "connection-campaign",
  first_reply: "replies-follow-up",
  first_call: "sales-calls",
  first_client: "sales-calls",
};
