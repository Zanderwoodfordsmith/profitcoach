import {
  buildCsvContent,
  csvFilenameStem,
  downloadCsvFile,
  type CsvCell,
} from "@/lib/exportCsv";
import {
  formatProspectLastAssessed,
  formatProspectNextCallWhen,
  getProspectNextCallName,
  getProspectNextCallStatusLabel,
} from "@/lib/prospectNextCall";
import type { ProspectRow } from "@/lib/prospectRow";

export type ProspectTableColumnKey =
  | "business"
  | "email"
  | "phone"
  | "type"
  | "coach"
  | "actions"
  | "last_score"
  | "last_assessed"
  | "created_at"
  | "revenue"
  | "team_size"
  | "years_in_business"
  | "outcome"
  | "obstacles"
  | "preferred_support"
  | "boss_level"
  | "next_call"
  | "next_action"
  | "status";

export type ProspectExportColumnKey =
  | "name"
  | "title"
  | "business"
  | "email"
  | "phone"
  | "type"
  | "coach"
  | "status"
  | "last_score"
  | "last_assessed"
  | "created_at"
  | "revenue"
  | "team_size"
  | "years_in_business"
  | "outcome"
  | "obstacles"
  | "preferred_support"
  | "boss_level"
  | "next_call"
  | "next_action"
  | "next_action_due";

const EXPORT_COLUMN_DEFS: Array<{
  key: ProspectExportColumnKey;
  label: string;
}> = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "business", label: "Business" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "type", label: "Type" },
  { key: "coach", label: "Coach" },
  { key: "status", label: "Status" },
  { key: "last_score", label: "Last score" },
  { key: "last_assessed", label: "Last assessed" },
  { key: "created_at", label: "Date created" },
  { key: "revenue", label: "Revenue" },
  { key: "team_size", label: "Team size" },
  { key: "years_in_business", label: "Years in business" },
  { key: "outcome", label: "Outcome" },
  { key: "obstacles", label: "Obstacles" },
  { key: "preferred_support", label: "Preferred support" },
  { key: "boss_level", label: "BOSS level" },
  { key: "next_call", label: "Next call" },
  { key: "next_action", label: "Next action" },
  { key: "next_action_due", label: "Next action due" },
];

const TABLE_KEY_TO_EXPORT: Partial<
  Record<ProspectTableColumnKey, ProspectExportColumnKey[]>
> = {
  business: ["business"],
  email: ["email"],
  phone: ["phone"],
  type: ["type"],
  coach: ["coach"],
  status: ["status"],
  last_score: ["last_score"],
  last_assessed: ["last_assessed"],
  created_at: ["created_at"],
  revenue: ["revenue"],
  team_size: ["team_size"],
  years_in_business: ["years_in_business"],
  outcome: ["outcome"],
  obstacles: ["obstacles"],
  preferred_support: ["preferred_support"],
  boss_level: ["boss_level"],
  next_call: ["next_call"],
  next_action: ["next_action", "next_action_due"],
};

function getExportCellValue(
  row: ProspectRow,
  key: ProspectExportColumnKey
): CsvCell {
  switch (key) {
    case "name":
      return row.full_name;
    case "title":
      return row.job_title;
    case "business":
      return row.business_name;
    case "email":
      return row.email;
    case "phone":
      return row.phone;
    case "type":
      return row.type;
    case "coach":
      return row.coach_name ?? row.coach_business_name ?? "";
    case "status":
      return row.status.label;
    case "last_score":
      return row.last_score ?? "";
    case "last_assessed":
      return row.last_completed_at
        ? formatProspectLastAssessed(row.last_completed_at)
        : "";
    case "created_at":
      return row.created_at ? formatProspectLastAssessed(row.created_at) : "";
    case "revenue":
      return row.revenue;
    case "team_size":
      return row.team_size;
    case "years_in_business":
      return row.years_in_business;
    case "outcome":
      return row.outcome;
    case "obstacles":
      return row.obstacles;
    case "preferred_support":
      return row.preferred_support;
    case "boss_level":
      return row.boss_level;
    case "next_call": {
      if (!row.next_call?.start_time) return "";
      const when = formatProspectNextCallWhen(row.next_call);
      const name = getProspectNextCallName(row.next_call);
      const status = getProspectNextCallStatusLabel(
        row.next_call.status_normalized
      );
      return [name, when, status].filter(Boolean).join(" · ");
    }
    case "next_action":
      return row.next_action?.text ?? "";
    case "next_action_due":
      return row.next_action?.dueAt ?? "";
    default:
      return "";
  }
}

export type ExportProspectsCsvInput = {
  mode: "shown" | "all";
  visibleTableKeys: ProspectTableColumnKey[];
  applicableTableKeys: ProspectTableColumnKey[];
  columnOrder: ProspectTableColumnKey[];
};

function buildExportColumnKeys(input: ExportProspectsCsvInput): ProspectExportColumnKey[] {
  const keys: ProspectExportColumnKey[] = ["name", "title", "business"];
  const seen = new Set<ProspectExportColumnKey>(keys);

  const tableKeys =
    input.mode === "shown"
      ? input.columnOrder.filter((key) => input.visibleTableKeys.includes(key))
      : input.columnOrder.filter((key) =>
          input.applicableTableKeys.includes(key)
        );

  for (const tableKey of tableKeys) {
    if (tableKey === "actions") continue;
    const mapped = TABLE_KEY_TO_EXPORT[tableKey];
    if (!mapped) continue;
    for (const exportKey of mapped) {
      if (exportKey === "business" && seen.has("business")) continue;
      if (!seen.has(exportKey)) {
        seen.add(exportKey);
        keys.push(exportKey);
      }
    }
  }

  if (input.mode === "all") {
    for (const def of EXPORT_COLUMN_DEFS) {
      if (!seen.has(def.key)) {
        seen.add(def.key);
        keys.push(def.key);
      }
    }
  }

  return keys;
}

export function exportProspectsToCsv(
  rows: ProspectRow[],
  input: ExportProspectsCsvInput,
  filenamePrefix = "prospects"
) {
  const columnKeys = buildExportColumnKeys(input);
  const headers = columnKeys.map(
    (key) => EXPORT_COLUMN_DEFS.find((def) => def.key === key)?.label ?? key
  );
  const csvRows = rows.map((row) =>
    columnKeys.map((key) => getExportCellValue(row, key))
  );
  const content = buildCsvContent(headers, csvRows);
  downloadCsvFile(`${csvFilenameStem(filenamePrefix)}.csv`, content);
}
