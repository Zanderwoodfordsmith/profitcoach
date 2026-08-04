/** First Campaign Setup — shared types */

export type CampaignStep = 1 | 2 | 3 | 4 | 5;

export type SourcingRoute = "strong" | "thin" | "none";

export type LeadListSource =
  | "lead_finder"
  | "connections"
  | "sales_nav_csv"
  | "sales_nav"
  | "mixed";

export type HouseIcpFilters = {
  roleTitles: string[];
  teamSize: string;
  revenueRange: string;
  geography: string;
};

export const HOUSE_ICP_FILTERS: HouseIcpFilters = {
  roleTitles: ["Owner", "Founder", "CEO", "Managing Director", "Co-founder"],
  teamSize: "11-50",
  revenueRange: "£1M-£10M",
  geography: "United Kingdom",
};

/** Titles that count as ICP decision-makers on a Connections.csv row */
export const ICP_TITLE_KEYWORDS = [
  "owner",
  "co-owner",
  "founder",
  "co-founder",
  "cofounder",
  "ceo",
  "chief executive",
  "managing director",
  "md ",
  " md",
  "proprietor",
  "principal",
] as const;

export type IcpProposal = {
  label: string;
  industry: string;
  geography: string;
  roleTitles: string[];
  teamSize: string;
  revenueRange: string;
  rationale: string;
  sourcingRoute: SourcingRoute;
  inventoryCount: number | null;
  inventoryNote: string;
  leadFinderFilters: Record<string, unknown>;
};

export type IdealClientProfilePayload = {
  targetMarket: {
    industry: string;
    industryExamples?: string[];
    geography: string;
    revenueRange: string;
    teamSize: string;
    businessStage?: string[];
  };
  decisionMaker: {
    roleTitles: string[];
    profile: string[];
    mindset?: string[];
  };
  currentReality: string[];
  corePainPoints: { theme?: string; points: { label?: string; text: string }[] }[];
  frustrationsTheySayOutLoud?: string[];
  whatKeepsThemAwakeAtNight?: string[];
  desiredOutcomes?: { label?: string; text: string }[];
  values?: { theyValue: string[]; theyReject: string[] };
  buyingTriggers?: string[];
  notAFit?: string[];
  coachPositioning?: {
    positioningStatement: string;
    whyThisCoach: string[];
    messagingHooks: string[];
  };
  oneLineSummary?: string;
};

export type LabelledPoint = { label?: string; text: string };

export type PsychologicalTriggers = {
  dreams: LabelledPoint[];
  pastFailures: LabelledPoint[];
  fears: LabelledPoint[];
  suspicions: LabelledPoint[];
  enemies: LabelledPoint[];
};

export type AvatarPersona = {
  headline: string;
  personaName: string;
  subjectPronoun: "he" | "she" | "they";
  demographics: {
    age: string;
    location: string;
    education: string;
    occupation: string;
    businessSize?: string;
  };
  specificProblem: { text: string; isQuoted: boolean };
  triggeringEvents: LabelledPoint[];
  background?: string;
  reality: { headingSuffix?: string; prose: string };
  internalMonologue: string;
  goals: LabelledPoint[];
  challenges: LabelledPoint[];
  behaviour?: LabelledPoint[];
  quote: string;
};

export type AvatarPayload = {
  triggers: PsychologicalTriggers;
  persona: AvatarPersona;
  industryVocabulary?: {
    customers?: string;
    staff?: string;
    jobs?: string;
    money?: string;
    extra?: string[];
  };
  mainDesires?: string[];
  messagingHooks?: string[];
};

export type CampaignMessageDraft = {
  id?: string;
  variantLabel: string;
  messageType: "connector" | "follow_up";
  body: string;
  tokens?: Record<string, string>;
};

/** Extended brain keys written after coach confirms avatar slices */
export type CampaignBrainSlice = {
  ideal_client?: string;
  industry_vocabulary?: string;
  pain_language?: string;
  messaging_hooks?: string;
  proof_framing?: string;
};

export const CAMPAIGN_BRAIN_KEYS = [
  "ideal_client",
  "industry_vocabulary",
  "pain_language",
  "messaging_hooks",
  "proof_framing",
] as const;

export type CampaignBrainKey = (typeof CAMPAIGN_BRAIN_KEYS)[number];

export type ParsedLinkedInConnection = {
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  email: string;
  company: string;
  position: string;
  connectedOn: string;
};
