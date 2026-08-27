import { getOutputById } from "./registry";

export type StudioHubCard = {
  id: string;
  /** Short category line above the title */
  eyebrow: string;
  title: string;
  description: string;
  accentClassName: string;
  eyebrowClassName: string;
  /**
   * Skill id for the chat workspace, or null when the card links elsewhere
   * (e.g. first campaign, lead finder).
   */
  outputId: string | null;
  /**
   * Optional dedicated path under the role prefix (e.g. `/first-campaign`).
   * Prefer this over the chat workspace when set.
   */
  dedicatedPath?: string;
  /** Hide from coach Create hub; admin-only tools. */
  adminOnly?: boolean;
  /** Further gate: Lead Finder allow-list (admin Create hub only). */
  requireLeadFinderAccess?: boolean;
  /**
   * Related registry skill ids when the card uses a dedicated tool path
   * instead of outputId (shown in Admin → Brand → Core brain → Create hub).
   */
  relatedSkillIds?: string[];
};

/**
 * Create hub tools — who you help, then profile, list, outreach, nurture, content.
 */
export const STUDIO_HUB_CARDS: StudioHubCard[] = [
  {
    id: "ideal-client",
    eyebrow: "Target",
    title: "Ideal Client Selector",
    description:
      "Import your LinkedIn, pick who you help first, then lock the Ideal Client.",
    accentClassName: "bg-gradient-to-br from-[#0e5a8a] via-[#1478b0] to-[#3a9fd0]",
    eyebrowClassName: "text-[#0c5290]",
    outputId: null,
    dedicatedPath: "/ideal-client",
    relatedSkillIds: ["choose_icp", "ideal_client", "avatar"],
  },
  {
    id: "linkedin-profile",
    eyebrow: "Profile",
    title: "LinkedIn Profile Optimizer",
    description:
      "Rewrite your headline, About, and experience so the right owners stop and read.",
    accentClassName: "bg-gradient-to-br from-[#0e7f9c] via-[#1ca0c2] to-[#4ec0db]",
    eyebrowClassName: "text-[#0e7f9c]",
    outputId: null,
    dedicatedPath: "/linkedin-profile",
    relatedSkillIds: ["linkedin_profile"],
  },
  {
    id: "lead-finder",
    eyebrow: "Find",
    title: "Lead Finder",
    description: "Search and import prospects when you’re building a list.",
    accentClassName: "bg-gradient-to-br from-[#134e7d] via-[#1b74ad] to-[#37a3d8]",
    eyebrowClassName: "text-[#0c5290]",
    outputId: null,
    dedicatedPath: "/lead-finder",
    adminOnly: true,
    requireLeadFinderAccess: true,
  },
  {
    id: "outreach",
    eyebrow: "Outreach",
    title: "First Campaign Outreach Messages",
    description:
      "Connection notes and follow-ups for the people you want on a call.",
    accentClassName: "bg-gradient-to-br from-[#0b4f8a] via-[#1166aa] to-[#2d9ce1]",
    eyebrowClassName: "text-[#0c5290]",
    outputId: "linkedin_connector",
  },
  {
    id: "vip",
    eyebrow: "Nurture",
    title: "Warm Replies",
    description: "Clear, unpushy replies when a warm lead messages you.",
    accentClassName: "bg-gradient-to-br from-[#1d5f8a] via-[#2b86b8] to-[#54b2dd]",
    eyebrowClassName: "text-[#0c5290]",
    outputId: "vip_nurture",
  },
  {
    id: "plan",
    eyebrow: "Draft",
    title: "Content Ideas",
    description: "Themes and cadence so you always know what to publish next.",
    accentClassName: "bg-gradient-to-br from-[#134e7d] via-[#0a6bb5] to-[#1483c8]",
    eyebrowClassName: "text-[#0c5290]",
    outputId: "content_planning",
  },
  {
    id: "newsletter",
    eyebrow: "Draft",
    title: "Newsletter Draft",
    description:
      "Draft this week’s LinkedIn newsletter edition in your voice.",
    accentClassName: "bg-gradient-to-br from-[#134e7d] via-[#1b74ad] to-[#37a3d8]",
    eyebrowClassName: "text-[#0c5290]",
    outputId: "linkedin_newsletter",
  },
  {
    id: "newsletter-planner",
    eyebrow: "Plan",
    title: "Newsletter Planner",
    description: "Plan your newsletter series and schedule each edition.",
    accentClassName: "bg-gradient-to-br from-[#0e5a8a] via-[#1478b0] to-[#3a9fd0]",
    eyebrowClassName: "text-[#0c5290]",
    outputId: null,
    dedicatedPath: "/newsletter",
    adminOnly: true,
    relatedSkillIds: ["linkedin_newsletter"],
  },
];

export function getStudioCardByOutputId(
  outputId: string
): StudioHubCard | undefined {
  return STUDIO_HUB_CARDS.find((c) => c.outputId === outputId);
}

export function studioWorkspaceHref(
  basePath: string,
  outputId: string
): string {
  return `${basePath}?skill=${encodeURIComponent(outputId)}`;
}

export function studioCardHref(
  card: StudioHubCard,
  prefix: "/coach" | "/admin",
  studioBasePath: string
): string {
  if (card.dedicatedPath) {
    if (card.adminOnly && prefix !== "/admin") {
      return studioBasePath;
    }
    return `${prefix}${card.dedicatedPath}`;
  }
  if (card.outputId) {
    return studioWorkspaceHref(studioBasePath, card.outputId);
  }
  return studioBasePath;
}

export function parseStudioSkillParam(skill: string | null): string | null {
  if (!skill) return null;
  return getOutputById(skill) ? skill : null;
}

export function studioDisplayTitle(outputId: string): string {
  const card = getStudioCardByOutputId(outputId);
  if (card) return card.title;
  return getOutputById(outputId)?.label ?? "Create";
}
