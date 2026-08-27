/**
 * Screen context for the docked AI panel: maps the current route to a
 * human label, a suggested skill, and a one-line description passed to
 * the model so it knows where the coach is working.
 */

export type AiScreenContext = {
  /** Short label shown in the panel chip, e.g. "Prospects". */
  label: string;
  /** Suggested registry output id for this surface (panel default). */
  suggestedOutputId: string | null;
  /** Entity id when the route addresses one record (prospect, contact…). */
  entityId: string | null;
  /** One-line prose description sent to the model. */
  description: string;
};

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type ScreenRule = {
  prefix: string;
  label: string;
  suggestedOutputId: string | null;
  describe: string;
};

/** Order matters: first matching prefix wins. */
const SCREEN_RULES: ScreenRule[] = [
  {
    prefix: "/linkedin-profile",
    label: "LinkedIn Profile",
    suggestedOutputId: "linkedin_profile",
    describe: "editing their own LinkedIn profile copy",
  },
  {
    prefix: "/linkedin",
    label: "Content",
    suggestedOutputId: "linkedin_content",
    describe: "planning and scheduling LinkedIn content",
  },
  {
    prefix: "/newsletter",
    label: "Newsletter",
    suggestedOutputId: "linkedin_newsletter",
    describe: "writing or planning their LinkedIn newsletter",
  },
  {
    prefix: "/lead-finder",
    label: "Lead Finder",
    suggestedOutputId: "linkedin_connector",
    describe: "finding and qualifying prospects on LinkedIn",
  },
  {
    prefix: "/blog",
    label: "Blog",
    suggestedOutputId: "linkedin_content",
    describe: "working on blog or long-form content",
  },
  {
    prefix: "/first-campaign",
    label: "First Campaign",
    suggestedOutputId: "choose_icp",
    describe: "working through First Campaign setup (ICP, avatar, messages, starter list)",
  },
  {
    prefix: "/ideal-client",
    label: "Ideal Client",
    suggestedOutputId: "ideal_client",
    describe: "choosing or refining their ideal client profile",
  },
  {
    prefix: "/message-generator",
    label: "Create",
    suggestedOutputId: null,
    describe: "in the Create hub",
  },
  {
    prefix: "/prospects",
    label: "Prospects",
    suggestedOutputId: "linkedin_connector",
    describe: "looking at their prospect list",
  },
  {
    prefix: "/pipeline",
    label: "Pipeline",
    suggestedOutputId: "linkedin_connector",
    describe: "looking at their prospect pipeline board",
  },
  {
    prefix: "/conversations",
    label: "Conversations",
    suggestedOutputId: "vip_nurture",
    describe: "in their prospect message inbox, likely drafting a reply",
  },
  {
    prefix: "/calls",
    label: "Calendar",
    suggestedOutputId: null,
    describe: "looking at their booked calls calendar",
  },
  {
    prefix: "/boss-pro",
    label: "Boss Pro",
    suggestedOutputId: "funnel_constraints",
    describe: "running a Boss Pro diagnostic workshop",
  },
  {
    prefix: "/clients",
    label: "Coach Clients",
    suggestedOutputId: "funnel_constraints",
    describe: "working with their coaching clients",
  },
  {
    prefix: "/playbooks",
    label: "Playbooks",
    suggestedOutputId: "funnel_constraints",
    describe: "browsing the BOSS playbooks library",
  },
  {
    prefix: "/community",
    label: "Community",
    suggestedOutputId: "linkedin_content",
    describe: "in the community",
  },
  {
    prefix: "/academy",
    label: "Classroom",
    suggestedOutputId: null,
    describe: "in the Classroom (lessons)",
  },
  {
    prefix: "/settings",
    label: "Settings",
    suggestedOutputId: null,
    describe: "in their account or funnel settings",
  },
  {
    prefix: "/roadmap",
    label: "Roadmap",
    suggestedOutputId: null,
    describe: "on the internal build roadmap board (jobs to be done)",
  },
];

export function deriveAiScreenContext(
  pathname: string | null
): AiScreenContext {
  const path = pathname ?? "";
  const rest = path.replace(/^\/(coach|admin)/, "");
  const entityId = rest.match(UUID_RE)?.[0] ?? null;

  for (const rule of SCREEN_RULES) {
    if (rest === rule.prefix || rest.startsWith(`${rule.prefix}/`)) {
      return {
        label: rule.label,
        suggestedOutputId: rule.suggestedOutputId,
        entityId,
        description: `The coach is currently ${rule.describe}${
          entityId ? ` (record ${entityId})` : ""
        }.`,
      };
    }
  }

  return {
    label: "Dashboard",
    suggestedOutputId: null,
    entityId,
    description: "The coach is on their dashboard.",
  };
}

/** Compact string sent to the API (kept short; the server truncates too). */
export function screenContextForApi(ctx: AiScreenContext): string {
  return ctx.description;
}
