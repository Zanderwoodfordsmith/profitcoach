/** Map DB rows ↔ wizard UI shapes for First Campaign Setup. */

import type {
  AvatarPayload,
  CampaignBrainKey,
  CampaignMessageDraft,
  CampaignStep,
  IdealClientProfilePayload,
  LeadListSource,
  ParsedLinkedInConnection,
  SourcingRoute,
  IcpProposal,
} from "./types";

export type MatchedConnection = ParsedLinkedInConnection & {
  id?: string;
  titleMatch?: boolean;
  matchedTitles?: string[];
};

export type ChosenIcp = IcpProposal & {
  id?: string;
  chosenAt?: string | null;
};

export type AvatarState = {
  profile: IdealClientProfilePayload | null;
  generated: AvatarPayload | null;
  edited: AvatarPayload | null;
  approvedAt: string | null;
  savedBrainKeys: CampaignBrainKey[];
};

export type MessagesState = {
  drafts: CampaignMessageDraft[];
  approvedAt: string | null;
  approvedVariants: string[];
};

export type LeadListSummary = {
  id: string;
  name?: string | null;
  source: LeadListSource;
  count: number;
  createdAt?: string | null;
};

export type CampaignSetupState = {
  currentStep: CampaignStep;
  icp: ChosenIcp | null;
  avatar: AvatarState | null;
  messages: MessagesState | null;
  leadList: LeadListSummary | null;
};

export const EMPTY_CAMPAIGN_STATE: CampaignSetupState = {
  currentStep: 1,
  icp: null,
  avatar: null,
  messages: null,
  leadList: null,
};

type IcpRow = {
  id: string;
  label: string;
  industry: string;
  geography: string;
  role_titles?: string[] | null;
  team_size?: string | null;
  revenue_range?: string | null;
  sourcing_route?: SourcingRoute | null;
  inventory_count?: number | null;
  lead_finder_filters?: Record<string, unknown> | null;
  profile_payload?: IdealClientProfilePayload | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AvatarRow = {
  id: string;
  icp_id?: string | null;
  generated_payload?: AvatarPayload | null;
  edited_payload?: AvatarPayload | null;
  approved_at?: string | null;
  brain_saved_keys?: string[] | null;
};

type MessageRow = {
  id: string;
  variant_label: string;
  message_type: "connector" | "follow_up";
  body: string;
  tokens?: Record<string, string> | null;
  approved_at?: string | null;
  sort_order?: number | null;
};

type LeadListRow = {
  id: string;
  name?: string | null;
  source: LeadListSource;
  item_count?: number | null;
  created_at?: string | null;
};

type SetupRowFormatted = {
  currentStep: CampaignStep;
};

export function mapIcpRowToChosen(row: IcpRow, rationale = ""): ChosenIcp {
  return {
    id: row.id,
    label: row.label,
    industry: row.industry,
    geography: row.geography ?? "",
    roleTitles: row.role_titles ?? [],
    teamSize: row.team_size ?? "",
    revenueRange: row.revenue_range ?? "",
    rationale,
    sourcingRoute: row.sourcing_route ?? "none",
    inventoryCount: row.inventory_count ?? null,
    inventoryNote: "",
    leadFinderFilters: row.lead_finder_filters ?? {},
    chosenAt: row.updated_at ?? row.created_at ?? null,
  };
}

export function mapAvatarRowToState(
  row: AvatarRow,
  profile: IdealClientProfilePayload | null = null
): AvatarState {
  return {
    profile,
    generated: row.generated_payload ?? null,
    edited: row.edited_payload ?? null,
    approvedAt: row.approved_at ?? null,
    savedBrainKeys: (row.brain_saved_keys ?? []).filter(Boolean) as CampaignBrainKey[],
  };
}

export function mapMessageRowsToDrafts(rows: MessageRow[]): CampaignMessageDraft[] {
  return rows.map((r) => ({
    id: r.id,
    variantLabel: r.variant_label,
    messageType: r.message_type,
    body: r.body,
    tokens: r.tokens ?? {},
  }));
}

export function mapMessageRowsToState(rows: MessageRow[]): MessagesState {
  const drafts = mapMessageRowsToDrafts(rows);
  const approved = rows.filter((r) => r.approved_at);
  return {
    drafts,
    approvedAt: approved.length
      ? (approved[approved.length - 1]?.approved_at ?? null)
      : null,
    approvedVariants: approved.map((r) => r.variant_label),
  };
}

export function mapLeadListRow(row: LeadListRow): LeadListSummary {
  return {
    id: row.id,
    name: row.name ?? null,
    source: row.source,
    count: row.item_count ?? 0,
    createdAt: row.created_at ?? null,
  };
}

type ConnectionRow = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  company?: string | null;
  position?: string | null;
  connected_on?: string | null;
  title_match?: boolean | null;
  matched_titles?: string[] | null;
  // Already-camel forms (local parse / legacy)
  firstName?: string;
  lastName?: string;
  linkedinUrl?: string;
  connectedOn?: string;
  matchedTitles?: string[];
};

/** Map coach_linkedin_connections row (or local parse) → UI connection shape. */
export function mapConnectionRow(row: ConnectionRow | Record<string, unknown>): MatchedConnection {
  const r = row as ConnectionRow;
  return {
    id: typeof r.id === "string" ? r.id : undefined,
    firstName: String(r.firstName ?? r.first_name ?? ""),
    lastName: String(r.lastName ?? r.last_name ?? ""),
    linkedinUrl: String(r.linkedinUrl ?? r.linkedin_url ?? ""),
    email: String(r.email ?? ""),
    company: String(r.company ?? ""),
    position: String(r.position ?? ""),
    connectedOn: String(r.connectedOn ?? r.connected_on ?? ""),
    titleMatch: Boolean(r.title_match ?? false),
    matchedTitles: (r.matchedTitles ?? r.matched_titles ?? []).filter(Boolean),
  };
}

export function mapConnectionRows(
  rows: Array<ConnectionRow | Record<string, unknown>> | null | undefined
): MatchedConnection[] {
  return (rows ?? []).map(mapConnectionRow);
}

/** Normalize GET /api/coach/campaign-setup payload into wizard state. */
export function normalizeCampaignSetupFromApi(raw: unknown): CampaignSetupState {
  if (!raw || typeof raw !== "object") return EMPTY_CAMPAIGN_STATE;

  const r = raw as Record<string, unknown>;
  const setup = r.setup as SetupRowFormatted | undefined;
  const icpRow = (r.selectedIcp ?? r.icp) as IcpRow | null | undefined;
  const avatarRow = (r.selectedAvatar ?? r.avatar) as AvatarRow | null | undefined;
  const listRow = (r.selectedLeadList ?? r.leadList) as LeadListRow | null | undefined;
  const messageRows = (r.messages as MessageRow[] | undefined) ?? [];

  const profileFromIcp =
    (icpRow?.profile_payload as IdealClientProfilePayload | null | undefined) ?? null;

  return {
    currentStep: (setup?.currentStep as CampaignStep) ?? 1,
    icp: icpRow?.id ? mapIcpRowToChosen(icpRow) : null,
    avatar: avatarRow?.id ? mapAvatarRowToState(avatarRow, profileFromIcp) : null,
    messages: messageRows.length ? mapMessageRowsToState(messageRows) : null,
    leadList: listRow?.id ? mapLeadListRow(listRow) : null,
  };
}
