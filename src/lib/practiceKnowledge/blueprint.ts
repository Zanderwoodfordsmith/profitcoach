import { hoursLabel } from "./brief";
import { guidePage } from "./clientSessions";
import { labelMissingField } from "./completeness";
import type { PracticeKnowledgeRow, PracticeReportPayload } from "./types";

/**
 * Where a section's content comes from. The sidebar is organised by business
 * area; this tag lives on each section inside a page.
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

export type BlueprintSection = {
  id: string;
  title: string;
  source: SectionSource;
  /** What the section is built from. Shown on the admin map. */
  from?: string[];
  /** Where the section is used once it is ready. Shown on the admin map. */
  feeds?: string;
};

export type BlueprintGroup = {
  label: string;
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
        heading: "The operating blueprint for your client practice",
        summary: "One document. LinkedIn and the conversation write it. Everything else reads from it.",
        sections: [],
      },
    ],
  },
  {
    label: "Foundation",
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
            from: ["Sign-up form: phone, WhatsApp", "LinkedIn: location", "Conversation, if missing"],
            feeds: "Booking page, reminders, BCA team",
          },
          {
            id: "calls",
            title: "When you take calls",
            source: "from_you",
            from: ["Conversation: client call times, prospect call times, hours a week"],
            feeds: "Booking page calendar",
          },
          {
            id: "domain",
            title: "Web address",
            source: "from_you",
            from: ["Conversation: your own domain, or a Profit Coach page at your name"],
            feeds: "Coach page, booking link, campaign links",
          },
          {
            id: "email",
            title: "Practice email",
            source: "from_you",
            from: ["Conversation: keep your own address, or have one set up"],
            feeds: "Campaign sending, client emails",
          },
        ],
      },
      {
        slug: "story",
        title: "Your Story and Proof",
        href: "/coach/practice/story",
        heading: "Turn your experience into commercial credibility",
        summary: "Here is the evidence we are using to position you.",
        sections: [
          {
            id: "experience",
            title: "Experience",
            source: "imported",
            from: ["LinkedIn: roles held", "LinkedIn: industries and companies"],
          },
          {
            id: "results",
            title: "Commercial achievements",
            source: "from_you",
            from: ["Conversation: career results with a from, a to, and a timeframe"],
            feeds: "LinkedIn rewrite, campaign messaging, call script",
          },
          {
            id: "superpowers",
            title: "Superpowers",
            source: "from_you",
            from: ["Conversation: superpowers", "Conversation: what makes you different"],
            feeds: "Your offer, LinkedIn rewrite",
          },
          {
            id: "problems",
            title: "Problems repeatedly solved",
            source: "from_you",
            from: ["Conversation: problems people ask you to solve"],
            feeds: "Pain points, campaign messaging",
          },
          {
            id: "bio",
            title: "Proof summary and short bio",
            source: "we_build",
            from: ["Story and proof sections above"],
            feeds: "LinkedIn About, introductions, newsletter sign-off",
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
            from: ["Conversation transcript", "One-to-one call transcripts", "LinkedIn posts"],
            feeds: "LinkedIn rewrite, campaign messaging, newsletters",
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
    pages: [
      {
        slug: "market",
        title: "Avatar and Pain Points",
        href: "/coach/practice/market",
        heading: "Know exactly who you are built to help",
        summary: "The market is the group. The buyer is the person who decides. The pain is why they call.",
        sections: [
          {
            id: "credibility",
            title: "Where you already have credibility",
            source: "from_you",
            from: ["LinkedIn: industries worked", "Conversation: industries you understand and can access"],
          },
          {
            id: "options",
            title: "Market options",
            source: "we_build",
            from: ["Story and proof", "Where you already have credibility"],
            feeds: "Decision Call",
          },
          {
            id: "avatar",
            title: "Your avatar",
            source: "we_build",
            from: ["Market options", "Conversation: who signs off on the work", "One-to-one call transcripts"],
            feeds: "Everything below, then campaign messaging",
          },
          {
            id: "pains",
            title: "Pain points",
            source: "we_build",
            from: ["Your avatar", "Conversation", "One-to-one call transcripts"],
            feeds: "Campaign messaging, newsletters, call script",
          },
          {
            id: "avoid",
            title: "Who you will not take",
            source: "from_you",
            from: ["Conversation: clients to avoid"],
            feeds: "Prospect criteria",
          },
          {
            id: "criteria",
            title: "Prospect criteria",
            source: "we_build",
            from: ["Your avatar", "Who you will not take"],
            feeds: "Get Clients prospect pool",
          },
        ],
      },
      {
        slug: "linkedin",
        title: "LinkedIn Profile",
        href: "/coach/practice/linkedin",
        heading: "Look credible before someone replies",
        summary: "The profile they read, and the rewrite once the direction is locked.",
        sections: [
          {
            id: "profile",
            title: "Current profile",
            source: "imported",
            from: ["LinkedIn import"],
          },
          {
            id: "rewrite",
            title: "Profile rewrite",
            source: "we_build",
            from: ["Story and proof", "Avatar and pain points", "Your offer", "Your voice"],
            feeds: "The coach's LinkedIn profile",
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
          },
          {
            id: "live",
            title: "Live campaigns",
            source: "live",
            from: ["Get Clients campaigns"],
          },
        ],
      },
      {
        slug: "conversations",
        title: "Conversations and Follow-Up",
        href: "/coach/practice/conversations",
        heading: "Turn interest into booked calls",
        summary: "Replies, follow-up, and the next message.",
        sections: [
          {
            id: "followup",
            title: "Follow-up and nurture",
            source: "we_build",
            from: ["Campaign messaging", "Your voice"],
            feeds: "Get Clients sequences",
          },
          {
            id: "inbox",
            title: "Conversations in progress",
            source: "live",
            from: ["LinkedIn inbox", "Get Clients replies"],
          },
        ],
      },
    ],
  },
  {
    label: "Win clients",
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
          },
          {
            id: "direction",
            title: "Offer and positioning",
            source: "we_build",
            from: ["Story and proof", "Avatar and pain points", "Fee and capacity"],
            feeds: "Decision Call, call script, LinkedIn rewrite",
          },
          {
            id: "payment",
            title: "Proposal and payment",
            source: "we_build",
            from: ["Decision Call", "Recommended format", "Fee and capacity"],
            feeds: "Proposal and payment link",
          },
        ],
      },
      {
        slug: "sales",
        title: "Your Sales Conversation",
        href: "/coach/practice/sales",
        heading: "Know exactly what to say when a prospect is interested",
        summary: "A call script built around your avatar's pain, and what each call teaches us.",
        sections: [
          {
            id: "value",
            title: "Your value session",
            source: "standard",
            from: ["Classroom: win clients, value sessions"],
            feeds: "Booking messages, sales calls",
          },
          {
            id: "script",
            title: "Your call script",
            source: "we_build",
            from: ["BCA sales conversation", "Your avatar", "Pain points", "Your offer"],
          },
          {
            id: "reviews",
            title: "Call reviews",
            source: "live",
            from: ["Recorded sales calls"],
          },
        ],
      },
    ],
  },
  {
    label: "Serve clients",
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
    pages: [
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
          },
          {
            id: "clients",
            title: "Active clients",
            source: "live",
            from: ["Client portfolio"],
          },
        ],
      },
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
          },
          {
            id: "newsletter",
            title: "Newsletter",
            source: "we_build",
            from: ["Pain points", "Commercial achievements", "Your voice"],
            feeds: "Newsletter tool",
          },
        ],
      },
      {
        slug: "ninety",
        title: "Next 90 Days",
        href: "/coach/practice/ninety",
        heading: "Know exactly what happens next",
        summary: "The objective, the constraint, and this month.",
        sections: [
          {
            id: "quarter",
            title: "This quarter",
            source: "we_build",
            from: ["Decision Call"],
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

export type CommandCenterModel = {
  lead: string;
  detail: string;
  completion: string;
  milestone: string;
  action: { label: string; href: string };
  building: string;
  call: string;
  recommendation: string;
  blocker: string;
  progress: string[];
};

export function commandCenter(row: PracticeKnowledgeRow): CommandCenterModel {
  const missing = row.missing_fields ?? [];
  const report = row.report_payload;
  const booked = row.payload.review.decision_call_booked_at?.value;
  const proofOpen = missing.includes("proof.career_results");
  const askedOpen =
    missing.includes("proof.problems_asked") ||
    missing.includes("proof.superpowers") ||
    missing.includes("proof.uniqueness");

  let lead = "You are building the brief for your practice.";
  let detail = "LinkedIn is the start. The conversation fills what a profile cannot.";
  let action = { label: "Open your Practice Blueprint", href: "/coach/practice/blueprint" };
  let building = "Waiting on the brief before we draft a market and a campaign angle.";
  let milestone = "Complete the brief";

  if (proofOpen) {
    lead = "You are capturing the proof behind your practice.";
    detail = "Your next step is one commercial result with a from, a to, and a timeframe.";
    action = { label: "Add the result in your blueprint", href: "/coach/practice/blueprint#brief-experience" };
    milestone = "One precise result";
  } else if (askedOpen) {
    lead = "You are turning experience into a position.";
    detail = "Your next step is the problems people already ask you to solve.";
    action = { label: "Continue the blueprint", href: "/coach/practice/blueprint#brief-experience" };
    milestone = "Problems you already solve";
  } else if (!report) {
    lead = "You have enough for a first recommendation.";
    detail = "BCA is ready to draft the market options and the campaign angle.";
    action = { label: "Read your Practice Blueprint", href: "/coach/practice/blueprint#brief-priorities" };
    building = "Writing the recommendation from the brief.";
    milestone = "Recommendation drafted";
  } else if (!row.coach_reviewed_at) {
    lead = "You are preparing the Decision Call.";
    detail = "BCA has drafted your market options and a campaign angle. Your next step is to read them and note what feels off.";
    action = { label: "Review the recommendation", href: "/coach/practice/blueprint#brief-priorities" };
    building = "Market options and a campaign angle are drafted. The Decision Call locks them.";
    milestone = "You review the recommendation";
  } else if (row.status === "ready_to_build" || row.status === "building") {
    lead = "You are preparing to launch your first campaign.";
    detail = "The Decision Record is the source. BCA builds LinkedIn, the campaign, follow-ups, and nurture from it.";
    action = { label: "See what is being built", href: "/coach/practice/campaigns" };
    building = "LinkedIn, the first campaign, follow-ups, and nurture are queued.";
    milestone = "First campaign";
  } else {
    lead = "The brief is in. The Decision Call makes the choices.";
    detail = booked
      ? "Your call is booked. Read the recommendation before you join."
      : "Your next step is to book the Decision Call.";
    action = booked
      ? { label: "Read the recommendation", href: "/coach/practice/blueprint#brief-priorities" }
      : { label: "Book the Decision Call", href: "/welcome" };
    building = "Holding the recommendation until the call locks one market, one offer, and one angle.";
    milestone = "Decision Call";
  }

  const progress: string[] = [];
  if (row.linkedin_seeded_at) progress.push("LinkedIn imported");
  if (row.interview_completed_at) progress.push("Conversation captured");
  if (row.report_generated_at) progress.push("Recommendation drafted");
  if (row.coach_reviewed_at) progress.push("You reviewed the brief");
  if (!progress.length) progress.push("Blueprint opened");

  return {
    lead,
    detail,
    completion: `The blueprint is ${row.completeness_score}% captured.`,
    milestone,
    action,
    building,
    call: booked ? `Booked ${new Date(booked).toLocaleString()}` : "Not booked yet",
    recommendation: report?.experience_summary
      ? report.experience_summary.slice(0, 280)
      : "Not written yet.",
    blocker: missing[0] ? labelMissingField(missing[0]) : "Nothing is blocking the next step.",
    progress,
  };
}

export type TopicCard = {
  title: string;
  source: SectionSource;
  status: "Ready" | "Open" | "Building";
  lines: string[];
};

type CardBody = Pick<TopicCard, "status" | "lines">;

const DEFAULT_BODY: Record<SectionSource, CardBody> = {
  imported: { status: "Open", lines: ["Not imported yet."] },
  from_you: { status: "Open", lines: ["Still open in the conversation."] },
  we_build: { status: "Building", lines: ["BCA writes this from your blueprint."] },
  standard: { status: "Ready", lines: ["The BCA standard."] },
  live: { status: "Building", lines: ["This fills once it is live. Nothing here is invented."] },
};

function sectionBody(key: string, row: PracticeKnowledgeRow): CardBody | null {
  const payload = row.payload;
  const report: PracticeReportPayload | null = row.report_payload;
  const roles = payload.market.roles_held?.value ?? [];
  const worked = payload.market.industries_worked?.value ?? [];
  const problems = payload.proof.problems_asked?.value ?? [];
  const career = payload.proof.career_results?.value ?? [];
  const buyers = payload.market.buyer_roles?.value ?? [];
  const avoid = payload.market.avoid?.value ?? [];

  const wt = payload.working_times;
  const id = payload.identity;

  switch (key) {
    case "setup:contact": {
      const lines = [
        id.phone?.value ? `Phone: ${id.phone.value}` : "",
        id.whatsapp?.value ? `WhatsApp: ${id.whatsapp.value}` : "",
        id.location?.value ? `Location: ${id.location.value}` : "",
        id.timezone?.value ? `Time zone: ${id.timezone.value}` : "",
      ].filter(Boolean);
      return {
        status: id.phone?.value ? "Ready" : "Open",
        lines: id.phone?.value ? lines : [...lines, "Phone number is still missing."],
      };
    }
    case "setup:calls": {
      const lines = [
        wt.preferred_hours?.value ? `Client calls: ${wt.preferred_hours.value}` : "",
        wt.prospect_call_hours?.value ? `Prospect calls: ${wt.prospect_call_hours.value}` : "",
        wt.hours_per_week?.value ? `Time on the practice: ${hoursLabel(wt.hours_per_week.value)}` : "",
      ].filter(Boolean);
      return lines.length ? { status: "Ready", lines } : null;
    }
    case "setup:domain":
      return {
        status: "Open",
        lines: [
          id.website?.value ? `Current site: ${id.website.value}` : "No site on file.",
          "Own domain, or a Profit Coach page at your name, is still to decide.",
        ],
      };
    case "setup:email":
      return { status: "Open", lines: ["Keep your own address, or have a practice email set up. Still to decide."] };
    case "story:experience":
      return {
        status: roles.length || worked.length ? "Ready" : "Open",
        lines: [
          roles.length ? `Roles: ${roles.join(", ")}` : "Roles are still open.",
          worked.length ? `Industries and companies: ${worked.join(", ")}` : "Industries are still open.",
        ],
      };
    case "story:results":
      return {
        status: career.length ? "Ready" : "Open",
        lines: career.length
          ? career.map((r) =>
              [r.role, r.company, r.metric_from && r.metric_to ? `${r.metric_from} to ${r.metric_to}` : "", r.timeframe]
                .filter(Boolean)
                .join(", ")
            )
          : ["One result with a from, a to, and a timeframe still needs to be said."],
      };
    case "story:superpowers": {
      const lines = [payload.proof.superpowers?.value, payload.proof.uniqueness?.value].filter(
        (line): line is string => Boolean(line)
      );
      return lines.length
        ? { status: "Ready", lines }
        : { status: "Open", lines: ["Drawn out in the conversation, not invented."] };
    }
    case "story:problems":
      return {
        status: problems.length ? "Ready" : "Open",
        lines: problems.length ? problems : ["This is extracted from the conversation, not invented as a superpower."],
      };
    case "story:bio":
      return report?.proof_inventory || report?.experience_summary
        ? { status: "Ready", lines: [report.proof_inventory || report.experience_summary] }
        : null;
    case "market:credibility":
      return {
        status: worked.length ? "Ready" : "Open",
        lines: worked.length ? worked : ["LinkedIn has not filled this yet."],
      };
    case "market:options":
      return report?.market_hypotheses?.length
        ? {
            status: "Ready",
            lines: report.market_hypotheses.map(
              (h) => `${h.industry}${h.buyer ? ` · ${h.buyer}` : ""}. ${h.problem}`
            ),
          }
        : { status: "Building", lines: ["Drafted once the blueprint has proof."] };
    case "market:avatar":
      return buyers.length ? { status: "Open", lines: [`Who signs off: ${buyers.join(", ")}`, "Locked on the Decision Call."] } : null;
    case "market:pains": {
      const pains = (report?.market_hypotheses ?? []).map((h) => h.problem).filter(Boolean);
      return pains.length ? { status: "Ready", lines: pains } : null;
    }
    case "market:avoid":
      return avoid.length ? { status: "Ready", lines: avoid } : null;
    case "offer:format":
      return {
        status: "Ready",
        lines: payload.practice.delivery_model?.value
          ? [
              `You described your work as ${payload.practice.delivery_model.value}.`,
              "BCA recommends the format. You can adjust it on the Decision Call.",
            ]
          : ["BCA recommends the format. You can adjust it on the Decision Call."],
      };
    case "offer:fee": {
      const lines = [
        payload.practice.min_fee?.value ? `Minimum fee: ${payload.practice.min_fee.value}` : "",
        payload.practice.capacity?.value ? `Capacity: ${payload.practice.capacity.value}` : "",
      ].filter(Boolean);
      return lines.length ? { status: "Ready", lines } : null;
    }
    case "offer:direction":
      return report?.offer_direction
        ? { status: "Ready", lines: [report.offer_direction, report.positioning].filter(Boolean) }
        : { status: "Building", lines: ["Written from the blueprint, then locked on the Decision Call."] };
    case "voice:rules":
      return { status: "Ready", lines: ["Everything BCA writes for you follows the BCA writing rules."] };
    case "linkedin:profile":
      return {
        status: payload.identity.linkedin_url?.value ? "Ready" : "Open",
        lines: [
          payload.identity.linkedin_url?.value || "LinkedIn URL is still open.",
          payload.identity.location?.value || "Location is still open.",
        ],
      };
    case "linkedin:rewrite":
      return { status: "Building", lines: ["The LinkedIn rewrite is built after the Decision Record is locked."] };
    case "market:criteria":
      return {
        status: report ? "Building" : "Open",
        lines: report
          ? ["Criteria are set on the Decision Call from the market options."]
          : ["Needs the market section of the blueprint first."],
      };
    case "campaigns:messaging":
      return report?.campaign_angle
        ? { status: "Ready", lines: [report.campaign_angle] }
        : { status: "Building", lines: ["Drafted from the blueprint. Not a live campaign yet."] };
    case "campaigns:live":
      return { status: "Building", lines: ["The first campaign is queued once the practice is ready to build."] };
    case "conversations:followup":
      return {
        status: "Building",
        lines: ["Reply handling and sequences are written with the first campaign, not before the angle is chosen."],
      };
    case "sales:script":
    case "offer:payment":
      return {
        status: "Building",
        lines: ["This is written from the locked Decision Record. It is one guide, not a pile of frameworks."],
      };
    case "content:posts":
    case "content:newsletter":
      return report ? null : { status: "Open", lines: ["Needs the recommendation first."] };
    case "ninety:quarter":
      return {
        status: report ? "Building" : "Open",
        lines: report?.decision_questions?.length
          ? report.decision_questions
          : ["The 90-day plan is set on the Decision Call."],
      };
    default:
      return null;
  }
}

export function topicCards(slug: string, row: PracticeKnowledgeRow): TopicCard[] {
  const page = blueprintPage(slug);
  if (!page) return [];
  return page.sections.map((section) => ({
    title: section.title,
    source: section.source,
    ...(sectionBody(`${slug}:${section.id}`, row) ?? DEFAULT_BODY[section.source]),
  }));
}
