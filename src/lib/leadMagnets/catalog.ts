export type LeadMagnetId = "boss-score" | "boss-score-pro";

export type LeadMagnetSequenceSlot = "started" | "completed";

export type LeadMagnetSequenceDef = {
  slot: LeadMagnetSequenceSlot;
  title: string;
  description: string;
  playbookId: string;
};

export type LeadMagnetDef = {
  id: LeadMagnetId;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  pathForSlug: (slug: string) => string;
  sequences: LeadMagnetSequenceDef[];
};

export const LEAD_MAGNETS: LeadMagnetDef[] = [
  {
    id: "boss-score",
    title: "Boss Score Assessment",
    description:
      "Short scorecard — owners opt in, take the assessment, and land in your prospects list.",
    imageSrc: "/landing/v2/dashboard.png",
    imageAlt: "Boss Score assessment preview",
    pathForSlug: (slug) => `/score/${slug}`,
    sequences: [
      {
        slot: "started",
        title: "Started, not completed",
        description:
          "They opened the scorecard and left. Nudge them back to finish.",
        playbookId: "scorecard-incomplete",
      },
      {
        slot: "completed",
        title: "Completed",
        description:
          "They finished. Walk the result and offer a review.",
        playbookId: "scorecard-complete",
      },
    ],
  },
  {
    id: "boss-score-pro",
    title: "Boss Score Pro Assessments",
    description:
      "Full 50-question diagnostic across every playbook — share when you want a deeper read on the business.",
    imageSrc: "/landing/c/hero-dashboard.png",
    imageAlt: "Boss Score Pro assessment preview",
    pathForSlug: (slug) => `/assessment-pro/${slug}`,
    sequences: [
      {
        slot: "started",
        title: "Started, not completed",
        description:
          "They started the diagnostic and left. Nudge them back to finish.",
        playbookId: "scorecard-pro-incomplete",
      },
      {
        slot: "completed",
        title: "Completed",
        description:
          "They finished the diagnostic. Make sense of the report and offer a review.",
        playbookId: "scorecard-pro-complete",
      },
    ],
  },
];

export const OUTREACH_PLAYBOOK_ORDER = [
  "vip-get-interest",
  "vip-nurture",
  "reply-interested",
] as const;

export const SUPERSEDED_PLAYBOOK_IDS = new Set([
  "pam-owner-dependence",
  "pam-profit-leakage",
  "pam-marketing",
  "connector-interest",
  "vip-100-scorecard",
  "nurture-90-day",
]);

const MAGNET_BY_ID = new Map(LEAD_MAGNETS.map((magnet) => [magnet.id, magnet]));

const MAGNET_BY_PLAYBOOK = new Map<string, LeadMagnetDef>();
const MAGNET_PLAYBOOK_IDS = new Set<string>();
for (const magnet of LEAD_MAGNETS) {
  for (const sequence of magnet.sequences) {
    MAGNET_BY_PLAYBOOK.set(sequence.playbookId, magnet);
    MAGNET_PLAYBOOK_IDS.add(sequence.playbookId);
  }
}

export function getLeadMagnet(id: string): LeadMagnetDef | null {
  return MAGNET_BY_ID.get(id as LeadMagnetId) ?? null;
}

export function magnetForPlaybookId(playbookId: string | null | undefined) {
  if (!playbookId) return null;
  return MAGNET_BY_PLAYBOOK.get(playbookId) ?? null;
}

export function isMagnetPlaybookId(playbookId: string | null | undefined) {
  return Boolean(playbookId && MAGNET_PLAYBOOK_IDS.has(playbookId));
}

export function isSupersededPlaybookId(playbookId: string | null | undefined) {
  return Boolean(playbookId && SUPERSEDED_PLAYBOOK_IDS.has(playbookId));
}

/** Campaigns whose CTA is this magnet. */
export function feedsMagnetId(
  playbookId: string | null | undefined
): LeadMagnetId | null {
  if (
    playbookId === "vip-get-interest" ||
    playbookId === "vip-nurture" ||
    playbookId === "reply-interested"
  ) {
    return "boss-score";
  }
  return null;
}

export const DEFAULT_CAMPAIGN_NAMES: Record<string, string[]> = {
  "vip-get-interest": ["Connector", "Connector · VIP 200 (2 weeks)"],
  "vip-nurture": ["Nurture", "VIP nurture (tools)"],
};

const PUBLIC_SHARE_HOST = "theprofitcoach.com";

export function magnetShareDisplayUrl(path: string, appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return `${origin}${path}`;
  }
  return `${PUBLIC_SHARE_HOST}${path}`;
}

export function magnetShareCopyUrl(path: string, appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return `${origin}${path}`;
  }
  return `https://${PUBLIC_SHARE_HOST}${path}`;
}

type OutreachSortable = {
  source_playbook_id?: string | null;
  status: string;
  lead_count?: number;
  updated_at: string;
};

export function partitionOutreachCampaigns<T extends OutreachSortable>(
  campaigns: T[]
): { ordered: T[]; more: T[] } {
  const byPlaybook = new Map<string, T>();
  for (const campaign of campaigns) {
    const id = campaign.source_playbook_id;
    if (id) byPlaybook.set(id, campaign);
  }

  const ordered: T[] = [];
  for (const id of OUTREACH_PLAYBOOK_ORDER) {
    const campaign = byPlaybook.get(id);
    if (campaign) ordered.push(campaign);
  }

  const more: T[] = [];
  for (const campaign of campaigns) {
    const id = campaign.source_playbook_id ?? null;
    if (isMagnetPlaybookId(id)) continue;
    if (id && OUTREACH_PLAYBOOK_ORDER.includes(id as (typeof OUTREACH_PLAYBOOK_ORDER)[number])) {
      continue;
    }
    if (
      isSupersededPlaybookId(id) &&
      campaign.status !== "running" &&
      !(campaign.lead_count ?? 0)
    ) {
      continue;
    }
    more.push(campaign);
  }

  more.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return { ordered, more };
}
