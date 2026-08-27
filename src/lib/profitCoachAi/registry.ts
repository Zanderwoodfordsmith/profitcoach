import type {
  ProfitCoachOutputDefinition,
  ProfitCoachRoleDefinition,
} from "./types";

/**
 * Programme order — matches First Campaign → Create hub → ongoing Get Clients.
 * Index 0 is the default skill when no route suggests another.
 */
export const PROFIT_COACH_OUTPUTS: ProfitCoachOutputDefinition[] = [
  {
    id: "choose_icp",
    label: "Choose ICP",
    description: "Pick the market you'll go after first — fit beats inventory",
    placeholder:
      "e.g. I'm weighing UK plumbing vs manufacturing—help me pick the right first ICP…",
    systemInstructions: `You help a BCA coach choose their first Ideal Client Profile (ICP) to target on LinkedIn.

Your job: narrow to ONE market to start with. Use their background, past client wins, and inventory reality (can they actually find these people on LinkedIn?). Fit beats breadth — one sharp ICP now beats three vague ones.

Offer 2–3 ranked options with clear rationale (who, why them, why now, sourcing confidence). Ask one clarifying question at a time if you need more signal. Do not let them skip the choice — "everyone" is not an ICP.

When they lock a choice, summarise in owner language: sector, revenue band, role/title, geography if relevant. Point them to Ideal Client profile next to flesh out pains and vocabulary.`,
    knowledgeRefs: [{ type: "ai-knowledge", file: "icp.md" }],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: ["superpowers", "client_results"],
      encouragement:
        "Past client wins and your background make ICP recommendations much sharper.",
    },
  },
  {
    id: "ideal_client",
    label: "Ideal Client profile",
    description:
      "Lock who you help — market, pains, vocabulary, hooks, and proof framing",
    placeholder:
      "e.g. Help me tighten pain language for UK manufacturing owners stuck at £2–5M…",
    systemInstructions: `You help a BCA coach build and lock their Ideal Client profile — the brain slice every downstream skill uses.

Work section by section when needed:
1. Ideal client — who (market, titles, size, revenue, geography)
2. Industry vocabulary — trade words this ICP actually uses
3. Pain language — frustrations and stuck points in their words (not coach jargon)
4. Messaging hooks — openers and angles that land with this ICP
5. Proof framing — how this coach's results should be positioned for them

Use what they already chose as ICP. Pull from real client stories when offered; never invent proof. Offer paste-ready bullets they can confirm into their brain. One section at a time if the profile is empty.

When the profile feels tight, nudge them to build the Avatar next (deeper psychographic layer).`,
    knowledgeRefs: [
      { type: "ai-knowledge", file: "icp.md" },
      {
        type: "playbook",
        path: "2. Defined Strategy/3.2 Positioning/Action 03 - Category Strategy.md",
      },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: [
        "ideal_client",
        "industry_vocabulary",
        "pain_language",
        "messaging_hooks",
        "proof_framing",
        "client_results",
      ],
      encouragement:
        "A concrete client story sharpens pain language and proof framing fast.",
    },
  },
  {
    id: "avatar",
    label: "Avatar",
    description:
      "Build the buyer avatar — fears, desires, and language in their words",
    placeholder:
      "e.g. Turn my locked ICP into a one-page avatar I can use for all outreach…",
    systemInstructions: `You help a BCA coach build a buyer Avatar from their locked Ideal Client profile.

The avatar is the psychographic layer: day-in-the-life, fears, desires, objections, and the exact phrases they use when stuck. Write TO the owner (you/your), not about them in the third person unless summarising for the coach.

Structure when useful: snapshot (who they are) → top 3 pains → what they've tried → what they want instead → objections to coaching/consulting → phrases to mirror in copy.

Ground everything in the coach's confirmed ICP and pain language. Never invent client results. If ideal client or pain language is thin, ask for one real example before drafting.

When the avatar is solid, point them to LinkedIn Profile Optimizer and Connector outreach next.`,
    knowledgeRefs: [
      { type: "ai-knowledge", file: "avatar-profile.md" },
      { type: "ai-knowledge", file: "icp.md" },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: ["ideal_client", "pain_language", "messaging_hooks"],
      encouragement:
        "Locked ideal client + pain language from First Campaign make the avatar much sharper.",
    },
  },
  {
    id: "linkedin_profile",
    label: "LinkedIn Profile Optimizer",
    description: "Headline, About, banner, and experience copy for your profile",
    placeholder:
      "e.g. Rewrite my headline and About for UK manufacturing owners stuck at £1–10M…",
    systemInstructions: `You help a BCA coach optimise their own LinkedIn profile so the right business owners recognise themselves and want to talk.

Write copy the coach can paste into LinkedIn. Default to:
1. Headline — who they help + the outcome, in owner language. Not “Business Coach | Helping leaders transform”. Keep it scannable; offer 3–5 options and mark a recommended default.
2. About — written TO the ideal client (you/your), not a CV. Pain in their words → mechanism (BOSS as a system, not therapy) → proof from the brain (never invent results) → clear next step (connect, newsletter, or a call). Short paragraphs.
3. Experience — current role framed as client outcomes, not job history. Optionally tighten 1–2 past roles if asked.
4. Banner / Featured — what to put on the banner (who + result) and what to feature (newsletter, proof, lead magnet). Do not generate images; give the words.

If current profile copy is missing, ask them to paste headline + About (one ask). Use the brain’s ideal client, pain language, and proof. Offer variants; let the coach choose.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "2. Defined Strategy/3.2 Positioning/Action 03 - Category Strategy.md",
      },
      {
        type: "playbook",
        path: "5. Revenue & Marketing/5.5 Branding/Action 01 - Brand Promise Definition.md",
      },
    ],
    useMarketingIcpTier2: true,
    promptEditor: "linkedin-optimizer",
    contextHints: {
      keys: ["ideal_client", "pain_language", "superpowers", "client_results"],
      encouragement:
        "Ideal client + a real client win make headline and About much sharper.",
    },
  },
  {
    id: "linkedin_connector",
    label: "Connector campaign",
    description: "Connection notes, follow-ups, LinkedIn campaigns",
    placeholder:
      "e.g. Help me write a connection note for UK manufacturing owners—I have proof from a £400K→£1.5M turnaround…",
    systemInstructions: `You are helping a BCA coach draft LinkedIn outbound: connection requests, follow-ups, and short campaigns.
Follow Profit Coach connector methodology: personalisation, proof, mechanism, CTA toward interest in the outcome—not “buy coaching” in the first touch.
Offer multiple variants when drafting copy; mark a recommended default; ask the coach to choose what fits their avatar and voice.`,
    knowledgeRefs: [
      { type: "legacy-knowledge", file: "connection-messages.md" },
      { type: "legacy-knowledge", file: "follow-up-campaigns.md" },
      { type: "legacy-knowledge", file: "connector-message-feedback.csv" },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: [
        "ideal_client",
        "pain_language",
        "messaging_hooks",
        "superpowers",
        "client_results",
      ],
      encouragement:
        "Ideal client, pain language, and a concrete client win make connector copy much stronger.",
    },
  },
  {
    id: "vip_nurture",
    label: "VIP nurture replies",
    description: "Email/DM replies for warm and VIP leads",
    placeholder:
      "e.g. Reply to a warm lead who asked about timing—we’re not pushy but want clarity…",
    systemInstructions: `Help craft nurture replies: warm, clear, value-led, aligned with diagnostic framing where appropriate.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/3.5 Lead Nurture/Action 02 - Content Cadence System.md",
      },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: ["client_results", "ideal_client", "pain_language"],
      encouragement: "A short client outcome helps credibility in nurture messages.",
    },
  },
  {
    id: "content_planning",
    label: "Content planning",
    description: "Cadence, themes, and calendar for marketing content",
    placeholder:
      "e.g. 90-day content plan for a coach focused on ops-heavy service firms…",
    systemInstructions: `Act as a content planning partner: themes, cadence, pillars tied to BOSS areas and the coach’s offer.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/3.5 Lead Nurture/Action 02 - Content Cadence System.md",
      },
    ],
    useMarketingIcpTier2: false,
    contextHints: {
      keys: ["ideal_client", "superpowers"],
      encouragement: "Your positioning line or ‘who I’m for’ keeps the plan focused.",
    },
  },
  {
    id: "linkedin_newsletter",
    label: "LinkedIn newsletter",
    description: "Write LinkedIn newsletter editions; optional 5-3-7 series planning",
    placeholder:
      "e.g. Draft this week's newsletter on pricing courage for owners stuck at £500K…",
    systemInstructions: `Help the coach write LinkedIn newsletters the Pam/BCA way.

Primary job: write THIS edition — one topic, paste-ready draft. Use the coach AI brain (ideal client, pain language, messaging hooks, vocabulary, proof, client results). Prefer Pam's 5-3-7 structure when it fits (5 strategies / 3 mistakes / 7 checklist) for an overview edition. One topic per edition; different pains/topics over time are normal.

Optional (only if asked): expand one overview into a longer content series (one follow-up edition per strategy/mistake/checklist item). Do not push a 16–26 edition plan unless the coach wants it.

Prefer 400–800 words; go ~2,000+ only for true guides/case studies. Scannable formatting. Offer SEO title/description and a short feed promo post.

For the live artifact editor + copy-for-LinkedIn, point them to Get Clients → Newsletter.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/5.5 Branding/Action 01 - Brand Promise Definition.md",
      },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: [
        "ideal_client",
        "pain_language",
        "messaging_hooks",
        "client_results",
        "superpowers",
      ],
      encouragement:
        "Ideal client + pain language from First Campaign make the 5-3-7 cascade much sharper.",
    },
  },
  {
    id: "linkedin_content",
    label: "LinkedIn posts",
    description: "Short posts, threads, and engagement ideas",
    placeholder:
      "e.g. Three post ideas targeting owners who are great technicians but weak on pipeline…",
    systemInstructions: `Draft or refine LinkedIn posts for the coach: hooks, body, CTA. Keep BOSS/owner language; prefer proof and specificity.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/5.5 Branding",
      },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: ["ideal_client", "pain_language", "superpowers", "hobbies_and_recent"],
      encouragement:
        "Your hobbies or recent wins can humanise posts—share if you’re comfortable.",
    },
  },
  {
    id: "funnel_constraints",
    label: "Funnel & constraints",
    description: "Analyse funnel math, bottlenecks, and offer constraints",
    placeholder:
      "e.g. Leads are up but calls flat—help me sanity-check conversion and next fixes…",
    systemInstructions: `Help the coach think through funnel stages, constraints, and prioritisation using BOSS-style clarity. Prefer questions that surface numbers; suggest playbook angles when relevant.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/4.5 Sales & Conversion/Action 04 - Diagnostic Call Framework.md",
      },
    ],
    useMarketingIcpTier2: false,
    contextHints: {
      keys: ["client_results"],
      encouragement: "Known conversion or revenue bands help calibrate advice.",
    },
  },
  {
    id: "coaching_ai",
    label: "Coaching AI",
    description: "Client-facing AI Coach — how the coach behaves for all clients",
    placeholder: "",
    systemInstructions: "",
    knowledgeRefs: [],
    coachPicker: false,
    promptEditor: "coach-ai",
  },
];

/** Skills coaches can pick in Create and the docked AI panel. */
export function getCoachPickerOutputs(): ProfitCoachOutputDefinition[] {
  return PROFIT_COACH_OUTPUTS.filter((o) => o.coachPicker !== false);
}

export const PROFIT_COACH_ROLES: ProfitCoachRoleDefinition[] = [
  {
    id: "marketing",
    label: "Marketing & content",
    description: "ICP through outreach, nurture, and content",
    outputIds: [
      "choose_icp",
      "ideal_client",
      "avatar",
      "linkedin_profile",
      "linkedin_connector",
      "vip_nurture",
      "content_planning",
      "linkedin_newsletter",
      "linkedin_content",
    ],
  },
  {
    id: "strategy",
    label: "Strategy & funnel",
    description: "Funnel thinking, offers, and constraints",
    outputIds: ["funnel_constraints", "content_planning", "choose_icp"],
  },
];

const outputById = new Map(PROFIT_COACH_OUTPUTS.map((o) => [o.id, o]));

export function getOutputById(id: string): ProfitCoachOutputDefinition | undefined {
  return outputById.get(id);
}

export function getDefaultOutputId(): string {
  return PROFIT_COACH_OUTPUTS[0]?.id ?? "choose_icp";
}

export function getRoleById(id: string): ProfitCoachRoleDefinition | undefined {
  return PROFIT_COACH_ROLES.find((r) => r.id === id);
}
