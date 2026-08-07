import type {
  ProfitCoachOutputDefinition,
  ProfitCoachRoleDefinition,
} from "./types";

export const PROFIT_COACH_OUTPUTS: ProfitCoachOutputDefinition[] = [
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
      keys: ["superpowers", "client_results"],
      encouragement:
        "A concrete client win or your differentiator makes connector copy much stronger.",
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
    placeholder: "e.g. Three post ideas targeting owners who are great technicians but weak on pipeline…",
    systemInstructions: `Draft or refine LinkedIn posts for the coach: hooks, body, CTA. Keep BOSS/owner language; prefer proof and specificity.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/5.5 Branding",
      },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: ["superpowers", "hobbies_and_recent"],
      encouragement:
        "Your hobbies or recent wins can humanise posts—share if you’re comfortable.",
    },
  },
  {
    id: "vip_nurture",
    label: "VIP nurture replies",
    description: "Email/DM replies for warm and VIP leads",
    placeholder: "e.g. Reply to a warm lead who asked about timing—we’re not pushy but want clarity…",
    systemInstructions: `Help craft nurture replies: warm, clear, value-led, aligned with diagnostic framing where appropriate.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/3.5 Lead Nurture/Action 02 - Content Cadence System.md",
      },
    ],
    useMarketingIcpTier2: true,
    contextHints: {
      keys: ["client_results"],
      encouragement: "A short client outcome helps credibility in nurture messages.",
    },
  },
  {
    id: "content_planning",
    label: "Content planning",
    description: "Cadence, themes, and calendar for marketing content",
    placeholder: "e.g. 90-day content plan for a coach focused on ops-heavy service firms…",
    systemInstructions: `Act as a content planning partner: themes, cadence, pillars tied to BOSS areas and the coach’s offer.`,
    knowledgeRefs: [
      {
        type: "playbook",
        path: "5. Revenue & Marketing/3.5 Lead Nurture/Action 02 - Content Cadence System.md",
      },
    ],
    useMarketingIcpTier2: false,
    contextHints: {
      keys: ["superpowers"],
      encouragement: "Your positioning line or ‘who I’m for’ keeps the plan focused.",
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
];

export const PROFIT_COACH_ROLES: ProfitCoachRoleDefinition[] = [
  {
    id: "marketing",
    label: "Marketing & content",
    description: "Newsletters, posts, nurture, and campaigns",
    outputIds: [
      "linkedin_connector",
      "linkedin_newsletter",
      "linkedin_content",
      "vip_nurture",
      "content_planning",
    ],
  },
  {
    id: "strategy",
    label: "Strategy & funnel",
    description: "Funnel thinking, offers, and constraints",
    outputIds: ["funnel_constraints", "content_planning"],
  },
];

const outputById = new Map(PROFIT_COACH_OUTPUTS.map((o) => [o.id, o]));

export function getOutputById(id: string): ProfitCoachOutputDefinition | undefined {
  return outputById.get(id);
}

export function getDefaultOutputId(): string {
  return PROFIT_COACH_OUTPUTS[0]?.id ?? "linkedin_connector";
}

export function getRoleById(id: string): ProfitCoachRoleDefinition | undefined {
  return PROFIT_COACH_ROLES.find((r) => r.id === id);
}
