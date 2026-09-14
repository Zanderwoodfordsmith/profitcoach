export type ProspectColumnKey =
  | "business_stats"
  | "coach"
  | "actions"
  | "boss_score"
  | "boss_score_premium"
  | "created_at"
  | "next_call"
  | "next_action"
  | "status"
  | "source"
  | "linkedin"
  | "crm";

export type ProspectColumnVisibility = Record<ProspectColumnKey, boolean>;

export const PROSPECTS_TABLE_SETTINGS_STORAGE_KEY = "prospects-table-settings-v14";

export const PROSPECTS_TABLE_COLUMN_OPTIONS: Array<{
  key: ProspectColumnKey;
  label: string;
}> = [
  { key: "status", label: "Status" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "source", label: "Source" },
  { key: "coach", label: "Coach" },
  { key: "actions", label: "Actions" },
  { key: "boss_score", label: "Boss" },
  { key: "boss_score_premium", label: "Boss Pro" },
  { key: "created_at", label: "Date created" },
  { key: "next_call", label: "Next call" },
  { key: "next_action", label: "Next action" },
  { key: "business_stats", label: "Business details" },
  { key: "crm", label: "CRM link" },
];

export const DEFAULT_PROSPECT_COLUMN_VISIBILITY: ProspectColumnVisibility = {
  linkedin: true,
  crm: false,
  source: true,
  coach: true,
  actions: false,
  status: true,
  boss_score: true,
  boss_score_premium: true,
  created_at: true,
  next_call: true,
  next_action: true,
  business_stats: false,
};

export const DEFAULT_PROSPECT_COLUMN_ORDER: ProspectColumnKey[] =
  PROSPECTS_TABLE_COLUMN_OPTIONS.map((option) => option.key);

export const ALL_PROSPECT_COLUMN_KEYS = DEFAULT_PROSPECT_COLUMN_ORDER;

export const PROSPECT_COLUMN_LEGACY_KEY_MAP: Record<string, ProspectColumnKey> = {
  last_score: "boss_score",
  last_assessed: "boss_score",
  revenue: "business_stats",
  team_size: "business_stats",
  years_in_business: "business_stats",
};
