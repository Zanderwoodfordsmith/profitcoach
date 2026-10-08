import { guidePage } from "./clientSessions";
import { labelMissingField } from "./completeness";
import { isFilledSourced } from "./sourced";
import type { PracticeKnowledgePayload, PracticeKnowledgeRow, Sourced } from "./types";

/**
 * The Practice Blueprint map: one document, grouped by business area.
 * Chapters (groups) hold pages; pages hold sections. The sidebar is its table
 * of contents, the admin map lists it, the AI conversation asks for its open
 * "From you" fields, and the Markdown export walks it in order.
 */
export const SECTION_SOURCES = {
  imported: {
    label: "Imported",
    hint: "Pulled from LinkedIn or sign-up. The coach only confirms it.",
  },
  from_you: {
    label: "From you",
    hint: "The coach tells us, in the AI conversation.",
  },
  we_build: {
    label: "We build",
    hint: "BCA writes it from the blueprint.",
  },
  standard: {
    label: "Standard",
    hint: "The BCA default. Coaches will be able to keep their own copy.",
  },
  live: {
    label: "Live",
    hint: "Real numbers from the platform once things are running.",
  },
} as const;

export type SectionSource = keyof typeof SECTION_SOURCES;

type Group = Exclude<keyof PracticeKnowledgePayload, "review">;

export type FieldKind = "text" | "list" | "results" | "stories" | "enum";

/** One captured fact inside a section, stored at payload[group][key]. */
export type FieldSpec = {
  path: `${Group}.${string}`;
  label: string;
  kind: FieldKind;
  /** The section counts as open until every required field is filled. */
  required?: boolean;
  /** How the AI conversation asks for it. */
  ask?: string;
  options?: { value: string; label: string }[];
};

export type BlueprintSection = {
  id: string;
  title: string;
  source: SectionSource;
  /** What the section is built from. Shown on the admin map. */
  from?: string[];
  /** Where the section is used once it is ready. Shown on the admin map. */
  feeds?: string;
  /** Imported and From you sections: the facts they hold. */
  fields?: FieldSpec[];
  /** We build sections: other sections ("page:id") that should exist first. */
  needs?: string[];
  /** Live sections: where the real numbers live today. */
  link?: { href: string; label: string };
};

export type BlueprintGroup = {
  label: string;
  /** Short line under the chapter title in the document. */
  intro: string;
  pages: BlueprintLink[];
};

export type BlueprintLink = {
  slug: string;
  title: string;
  href: string;
  heading: string;
  summary: string;
  sections: BlueprintSection[];
};

const HOURS_OPTIONS = [
  { value: "under_2_hours", label: "Under 2 hours a week" },
  { value: "2_5_hours_week", label: "2 to 5 hours a week" },
  { value: "5_10_hours_week", label: "5 to 10 hours a week" },
  { value: "10_15_hours_week", label: "10 to 15 hours a week" },
  { value: "15_plus_hours_week", label: "15 or more hours a week" },
];

function guideSections(slug: string): BlueprintSection[] {
  return (guidePage(slug)?.cards ?? []).map((card) => ({
    id: card.id,
    title: card.title,
    source: "standard",
    from: ["Classroom: coach clients"],
  }));
}

export const BLUEPRINT_GROUPS: BlueprintGroup[] = [
  {
    label: "Start here",
    intro: "Where you are, and the whole blueprint in one place.",
    pages: [
      {
        slug: "command",
        title: "Command Center",
        href: "/coach/practice",
        heading: "Your next best action",
        summary: "Where you are, what BCA is building, and the one thing that needs you.",
        sections: [],
      },
      {
        slug: "blueprint",
        title: "Your Practice Blueprint",
        href: "/coach/practice/blueprint",
        heading: "The Practice Blueprint",
        summary: "Everything about your practice in one document. Read it, approve it, download it.",
        sections: [],
      },
    ],
  },
  {
    label: "Foundation",
    intro: "Who you are, what you have done, and how you sound.",
    pages: [
      {
        slug: "setup",
        title: "Practice Setup",
        href: "/coach/practice/setup",
        heading: "The basics we need to set you up",
        summary: "How clients reach you, when you take calls, and where your practice lives online.",
        sections: [
          {
            id: "contact",
            title: "Phone and contact details",
            source: "imported",
            from: ["Sign-up form: phone", "LinkedIn: location", "Conversation, if missing"],
            feeds: "Booking page, reminders, BCA team",
            fields: [
              { path: "identity.phone", label: "Phone", kind: "text", required: true, ask: "What is the best mobile number for us and for booking reminders?" },
              { path: "identity.whatsapp", label: "WhatsApp", kind: "text" },
              { path: "identity.location", label: "Location", kind: "text" },
              { path: "identity.timezone", label: "Time zone", kind: "text" },
            ],
          },
          {
            id: "calls",
            title: "When you take calls",
            source: "from_you",
            from: ["Conversation: client call times, prospect call times, hours a week"],
            feeds: "Booking page calendar",
            fields: [
              { path: "working_times.preferred_hours", label: "Client calls", kind: "text", required: true, ask: "Which days and times do you want to run client sessions?" },
              { path: "working_times.prospect_call_hours", label: "Prospect calls", kind: "text", required: true, ask: "When can you take calls with new prospects?" },
              { path: "working_times.hours_per_week", label: "Time on the practice", kind: "enum", options: HOURS_OPTIONS, ask: "How many hours a week can you give the practice right now?" },
            ],
          },
          {
            id: "domain",
            title: "Web address",
            source: "from_you",
            from: ["Conversation: your own domain, or a Profit Coach page at your name"],
            feeds: "Coach page, booking link, campaign links",
            fields: [
              { path: "identity.web_address", label: "Web address", kind: "text", required: true, ask: "Do you want your own domain for your practice site, or a Profit Coach page at your name? If your own, what is the domain?" },
              { path: "identity.website", label: "Current site", kind: "text" },
            ],
          },
          {
            id: "email",
            title: "Practice email",
            source: "from_you",
            from: ["Conversation: keep your own address, or have one set up"],
            feeds: "Campaign sending, client emails",
            fields: [
              { path: "identity.practice_email", label: "Practice email", kind: "text", required: true, ask: "Do you want to use your own email address for the practice, or have us set one up?" },
            ],
          },
        ],
      },
      {
        slug: "story",
        title: "Your Story and Proof",
        href: "/coach/practice/story",
        heading: "Turn your experience into commercial credibility",
        summary: "The evidence we use to position you, and the documents that carry it.",
        sections: [
          {
            id: "experience",
            title: "Experience",
            source: "imported",
            from: ["LinkedIn: roles held", "LinkedIn: industries and companies"],
            fields: [
              { path: "market.roles_held", label: "Roles", kind: "list", required: true },
              { path: "market.industries_worked", label: "Industries and companies", kind: "list", required: true },
            ],
          },
          {
            id: "results",
            title: "Commercial achievements",
            source: "from_you",
            from: ["Conversation: career results with a from, a to, and a timeframe"],
            feeds: "LinkedIn rewrite, campaign messaging, call script",
            fields: [
              { path: "proof.career_results", label: "Results", kind: "results", required: true, ask: "What is your strongest commercial result? I need a from, a to, and a timeframe." },
              { path: "proof.client_results", label: "Client stories", kind: "stories" },
            ],
          },
          {
            id: "superpowers",
            title: "Superpowers",
            source: "from_you",
            from: ["Conversation: superpowers", "Conversation: what makes you different"],
            feeds: "Your offer, LinkedIn rewrite",
            fields: [
              { path: "proof.superpowers", label: "Superpowers", kind: "text", required: true, ask: "What do people come to you for that others cannot do as well?" },
              { path: "proof.uniqueness", label: "What makes you different", kind: "text", ask: "What makes the way you work different from other advisers?" },
              { path: "proof.proudest", label: "Proudest moments", kind: "list" },
            ],
          },
          {
            id: "problems",
            title: "Problems repeatedly solved",
            source: "from_you",
            from: ["Conversation: problems people ask you to solve"],
            feeds: "Pain points, campaign messaging",
            fields: [
              { path: "proof.problems_asked", label: "Problems", kind: "list", required: true, ask: "What problems do owners and colleagues keep asking you to help with?" },
            ],
          },
          {
            id: "bio",
            title: "Proof summary and short bio",
            source: "we_build",
            from: ["Story and proof sections above"],
            feeds: "LinkedIn About, introductions, newsletter sign-off",
            needs: [],
          },
          {
            id: "onepager",
            title: "Your one-page profile",
            source: "we_build",
            from: ["Proof summary", "Your avatar", "Your offer"],
            feeds: "Partners, recruiters, accountants, banks, events",
            needs: ["story:bio", "market:avatar"],
          },
        ],
      },
      {
        slug: "voice",
        title: "Your Voice",
        href: "/coach/practice/voice",
        heading: "Sound like you in everything we write",
        summary: "How you talk, so the LinkedIn rewrite, campaigns, and newsletters read like you wrote them.",
        sections: [
          {
            id: "sound",
            title: "How you sound",
            source: "we_build",
            from: ["Conversation transcript", "LinkedIn About and posts"],
            feeds: "LinkedIn rewrite, campaign messaging, newsletters",
            needs: [],
          },
          {
            id: "rules",
            title: "Writing rules",
            source: "standard",
            from: ["BCA writing rules"],
            feeds: "Everything BCA writes for the coach",
          },
        ],
      },
    ],
  },
  {
    label: "Get calls",
    intro: "Who you help, what hurts, and how we start the conversation.",
    pages: [
      {
        slug: "market",
        title: "Avatar and Pain Points",
        href: "/coach/practice/market",
        heading: "Know exactly who you are built to help",
        summary: "The market is the group. The avatar is the person. The pain is why they call.",
        sections: [
          {
            id: "credibility",
            title: "Where you already have credibility",
            source: "from_you",
            from: ["LinkedIn: industries worked", "Conversation: industries you understand and can access"],
            fields: [
              { path: "market.industries_credibility", label: "Credibility in", kind: "list", required: true, ask: "Which industries would be most impressed by your results?" },
              { path: "market.industries_understand", label: "Understand from the inside", kind: "list" },
              { path: "market.industries_access", label: "Can reach easily", kind: "list" },
              { path: "market.buyer_roles", label: "Who signs off", kind: "list", ask: "In those businesses, who signs off on hiring someone like you?" },
            ],
          },
          {
            id: "options",
            title: "Market options",
            source: "we_build",
            from: ["Story and proof", "Where you already have credibility"],
            feeds: "Decision Call, your avatar",
            needs: [],
          },
          {
            id: "avatar",
            title: "Your avatar",
            source: "we_build",
            from: ["Market options", "Industry library", "One-to-one call transcripts"],
            feeds: "Everything below, then campaign messaging",
            needs: ["market:options"],
          },
          {
            id: "pains",
            title: "Pain points",
            source: "we_build",
            from: ["Your avatar", "Industry library", "One-to-one call transcripts"],
            feeds: "Campaign messaging, newsletters, call script",
            needs: ["market:avatar"],
          },
          {
            id: "avoid",
            title: "Who you will not take",
            source: "from_you",
            from: ["Conversation: clients to avoid"],
            feeds: "Prospect criteria",
            fields: [
              { path: "market.avoid", label: "Will not take", kind: "list", required: true, ask: "Who will you not work with, whatever they pay?" },
            ],
          },
          {
            id: "criteria",
            title: "Prospect criteria",
            source: "we_build",
            from: ["Your avatar", "Who you will not take"],
            feeds: "Get Clients prospect pool",
            needs: ["market:avatar"],
          },
        ],
      },
      {
        slug: "linkedin",
        title: "LinkedIn Profile",
        href: "/coach/practice/linkedin",
        heading: "Look credible before someone replies",
        summary: "The profile they read, and the rewrite that carries your proof.",
        sections: [
          {
            id: "profile",
            title: "Current profile",
            source: "imported",
            from: ["LinkedIn import"],
            fields: [
              { path: "identity.linkedin_url", label: "LinkedIn", kind: "text", required: true },
            ],
          },
          {
            id: "visibility",
            title: "Public or discreet",
            source: "from_you",
            from: ["Conversation: can you say you are a business coach yet?"],
            feeds: "Profile rewrite",
            fields: [
              {
                path: "identity.linkedin_visibility",
                label: "On LinkedIn",
                kind: "enum",
                required: true,
                ask: "Can your LinkedIn say you are a business coach, or do you need to stay discreet for now (still employed, or a non-compete)?",
                options: [
                  { value: "public", label: "Public: I can say I coach" },
                  { value: "discreet", label: "Discreet for now" },
                ],
              },
            ],
          },
          {
            id: "rewrite",
            title: "Profile rewrite",
            source: "we_build",
            from: ["Story and proof", "Avatar and pain points", "Your offer", "Your voice"],
            feeds: "The coach's LinkedIn profile",
            needs: ["story:bio", "market:pains", "voice:sound"],
          },
        ],
      },
      {
        slug: "campaigns",
        title: "Campaigns",
        href: "/coach/practice/campaigns",
        heading: "Create a repeatable flow of conversations",
        summary: "What to say to your avatar, and what is live.",
        sections: [
          {
            id: "messaging",
            title: "Campaign messaging",
            source: "we_build",
            from: ["Pain points", "Commercial achievements", "Your voice"],
            feeds: "Get Clients campaign builder",
            needs: ["market:pains", "voice:sound"],
          },
          {
            id: "live",
            title: "Live campaigns",
            source: "live",
            from: ["Get Clients campaigns"],
            link: { href: "/coach/campaigns", label: "Open Campaigns" },
          },
        ],
      },
      {
        slug: "conversations",
        title: "Conversations and Follow-Up",
        href: "/coach/practice/conversations",
        heading: "Turn interest into booked calls",
        summary: "Replies, follow-up, and nurture for the people who say not yet.",
        sections: [
          {
            id: "followup",
            title: "Replies and nurture",
            source: "we_build",
            from: ["Campaign messaging", "Pain points", "Your voice"],
            feeds: "Get Clients sequences, reply co-pilot",
            needs: ["campaigns:messaging"],
          },
          {
            id: "inbox",
            title: "Conversations in progress",
            source: "live",
            from: ["LinkedIn inbox", "Get Clients replies"],
            link: { href: "/coach/conversations", label: "Open Conversations" },
          },
        ],
      },
    ],
  },
  {
    label: "Win clients",
    intro: "What you sell, how you price it, and what you say on the call.",
    pages: [
      {
        slug: "offer",
        title: "Your Offer",
        href: "/coach/practice/offer",
        heading: "Make your value easy to understand and easy to buy",
        summary: "What you sell, why your avatar should choose you, and how you get paid.",
        sections: [
          {
            id: "format",
            title: "Recommended format",
            source: "standard",
            from: ["BCA delivery format"],
            feeds: "Proposal and payment, first four sessions",
          },
          {
            id: "fee",
            title: "Fee and capacity",
            source: "from_you",
            from: ["Conversation: minimum fee, how many clients you want"],
            fields: [
              { path: "practice.min_fee", label: "Minimum monthly fee", kind: "text", required: true, ask: "What is the least you would take per client per month?" },
              { path: "practice.capacity", label: "Clients you want", kind: "text", ask: "How many clients do you want at once?" },
              {
                path: "practice.delivery_model",
                label: "How you like to work",
                kind: "enum",
                options: [
                  { value: "coaching", label: "Coaching" },
                  { value: "consulting", label: "Consulting" },
                  { value: "advisory", label: "Advisory" },
                  { value: "hybrid", label: "A mix" },
                ],
              },
            ],
          },
          {
            id: "direction",
            title: "Offer and positioning",
            source: "we_build",
            from: ["Story and proof", "Avatar and pain points", "Fee and capacity"],
            feeds: "Decision Call, call script, LinkedIn rewrite",
            needs: ["market:pains", "story:bio"],
          },
          {
            id: "payment",
            title: "Proposal and payment",
            source: "we_build",
            from: ["Offer and positioning", "Recommended format", "Fee and capacity"],
            feeds: "Proposal and payment link",
            needs: ["offer:direction"],
          },
        ],
      },
      {
        slug: "sales",
        title: "Your Sales Conversation",
        href: "/coach/practice/sales",
        heading: "Know exactly what to say when a prospect is interested",
        summary: "A value session that earns the call, and a script built around your avatar's pain.",
        sections: [
          {
            id: "howto",
            title: "How a value session runs",
            source: "standard",
            from: ["Classroom: win clients, value sessions"],
            feeds: "Your value session",
          },
          {
            id: "value",
            title: "Your value session",
            source: "we_build",
            from: ["Superpowers", "Pain points", "Your voice"],
            feeds: "Booking messages, newsletter sign-off, LinkedIn",
            needs: ["market:pains", "voice:sound"],
          },
          {
            id: "script",
            title: "Your call script",
            source: "we_build",
            from: ["BCA sales conversation", "Your avatar", "Pain points", "Your offer"],
            needs: ["offer:direction", "market:pains"],
          },
          {
            id: "reviews",
            title: "Call reviews",
            source: "live",
            from: ["Recorded sales calls"],
            link: { href: "/coach/calls", label: "Open Calls" },
          },
        ],
      },
    ],
  },
  {
    label: "Serve clients",
    intro: "How every client starts, and how every session runs.",
    pages: [
      {
        slug: "start",
        title: "Onboard a New Client",
        href: "/coach/practice/start",
        heading: "Set up every new client the same way",
        summary: "One shared folder, the latest coaching sheet, and a short list of what you still need to cover.",
        sections: guideSections("start"),
      },
      {
        slug: "foundations",
        title: "First Four Sessions",
        href: "/coach/practice/foundations",
        heading: "The first four sessions with a new client",
        summary: "Dashboard, the critical issue, the three-year plan, and the ninety-day plan. The order can flex. The work should not.",
        sections: guideSections("foundations"),
      },
      {
        slug: "every-session",
        title: "Every Session",
        href: "/coach/practice/every-session",
        heading: "How to open, run, and close any session",
        summary: "The same open, the same close, and the coaching sheet. Use it from the first meeting.",
        sections: guideSections("every-session"),
      },
    ],
  },
  {
    label: "Grow your practice",
    intro: "Visible trust, the numbers, and the next quarter.",
    pages: [
      {
        slug: "content",
        title: "Content and Newsletters",
        href: "/coach/practice/content",
        heading: "Turn your experience into visible trust",
        summary: "Posts, newsletters, and proof drawn from the blueprint, not a blank page.",
        sections: [
          {
            id: "posts",
            title: "Posts and proof",
            source: "we_build",
            from: ["Story and proof", "Pain points", "Your voice"],
            feeds: "LinkedIn posts",
            needs: ["market:pains", "voice:sound"],
          },
          {
            id: "newsletter",
            title: "Newsletter",
            source: "we_build",
            from: ["Pain points", "Commercial achievements", "Your voice", "Your value session"],
            feeds: "Newsletter tool",
            needs: ["market:pains", "voice:sound"],
          },
        ],
      },
      {
        slug: "scorecard",
        title: "Practice Scorecard",
        href: "/coach/practice/scorecard",
        heading: "Know what is working and what needs attention",
        summary: "Pipeline, clients, and revenue. The numbers that show the constraint.",
        sections: [
          {
            id: "numbers",
            title: "Practice numbers",
            source: "live",
            from: ["Get Clients pipeline", "Payments"],
            link: { href: "/coach/campaigns", label: "Open Get Clients" },
          },
          {
            id: "clients",
            title: "Active clients",
            source: "live",
            from: ["Client portfolio"],
            link: { href: "/coach/clients", label: "Open Clients" },
          },
        ],
      },
      {
        slug: "ninety",
        title: "Next 90 Days",
        href: "/coach/practice/ninety",
        heading: "Know exactly what happens next",
        summary: "The objective, the weekly numbers, and this week.",
        sections: [
          {
            id: "quarter",
            title: "Your 90-day launch plan",
            source: "we_build",
            from: ["Your offer", "Fee and capacity", "When you take calls"],
            needs: ["offer:direction"],
          },
        ],
      },
    ],
  },
];

export const BLUEPRINT_PAGES = BLUEPRINT_GROUPS.flatMap((group) => group.pages);

export function blueprintPage(slug: string): BlueprintLink | null {
  return BLUEPRINT_PAGES.find((page) => page.slug === slug) ?? null;
}

export type SectionRef = { group: BlueprintGroup; page: BlueprintLink; section: BlueprintSection; key: string };

/** Every section in document order, with its "page:id" key. */
export const BLUEPRINT_SECTIONS: SectionRef[] = BLUEPRINT_GROUPS.flatMap((group) =>
  group.pages.flatMap((page) =>
    page.sections.map((section) => ({ group, page, section, key: `${page.slug}:${section.id}` }))
  )
);

export function sectionByKey(key: string): SectionRef | null {
  return BLUEPRINT_SECTIONS.find((ref) => ref.key === key) ?? null;
}

/** We build sections in an order where every section comes after what it needs. */
export function buildOrder(): string[] {
  const keys = BLUEPRINT_SECTIONS.filter((r) => r.section.source === "we_build").map((r) => r.key);
  const done = new Set<string>();
  const out: string[] = [];
  const visit = (key: string, depth = 0) => {
    if (done.has(key) || depth > 20) return;
    for (const need of sectionByKey(key)?.section.needs ?? []) visit(need, depth + 1);
    done.add(key);
    out.push(key);
  };
  keys.forEach((k) => visit(k));
  return out;
}

export function fieldValue(
  payload: PracticeKnowledgePayload,
  path: FieldSpec["path"]
): Sourced<unknown> | null {
  const [group, key] = path.split(".") as [Group, string];
  const bucket = payload[group] as Record<string, Sourced<unknown> | null> | undefined;
  return bucket?.[key] ?? null;
}

export function fieldFilled(payload: PracticeKnowledgePayload, field: FieldSpec): boolean {
  return isFilledSourced(fieldValue(payload, field.path));
}

export type SectionState = "ready" | "open" | "building" | "live";

/** Where a section stands for one coach. Drives the chips, the "still needed" list, and the admin map. */
export function sectionState(ref: SectionRef, row: PracticeKnowledgeRow): SectionState {
  const { section, key } = ref;
  switch (section.source) {
    case "imported":
    case "from_you": {
      const required = (section.fields ?? []).filter((f) => f.required);
      const check = required.length ? required : section.fields ?? [];
      return check.every((f) => fieldFilled(row.payload, f)) ? "ready" : "open";
    }
    case "we_build":
      return row.built_sections[key] ? "ready" : "building";
    case "standard":
      return "ready";
    case "live":
      return "live";
  }
}

/** Imported and From you sections that still need something from the coach. */
export function stillNeeded(row: PracticeKnowledgeRow): SectionRef[] {
  return BLUEPRINT_SECTIONS.filter(
    (ref) =>
      (ref.section.source === "from_you" || ref.section.source === "imported") &&
      sectionState(ref, row) === "open"
  );
}

/** Open fields with the question to ask, for the AI conversation agenda. */
export function openQuestions(row: PracticeKnowledgeRow): { path: string; label: string; ask: string }[] {
  const out: { path: string; label: string; ask: string }[] = [];
  for (const ref of BLUEPRINT_SECTIONS) {
    for (const field of ref.section.fields ?? []) {
      if (!field.ask || fieldFilled(row.payload, field)) continue;
      out.push({ path: field.path, label: `${ref.section.title}: ${field.label}`, ask: field.ask });
    }
  }
  return out;
}

