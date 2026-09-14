import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import {
  PROSPECT_SOURCE_CHART_STACK_ORDER,
  resolveProspectSourceKind,
  resolveProspectSourceLabel,
} from "@/lib/prospectSourceKind";
import { PROSPECT_STATUS_VALUES, humanizeProspectStatus } from "@/lib/prospectStatus";
import type { ProspectRow } from "@/lib/prospectRow";

export type ProspectGroupField =
  | "status"
  | "source"
  | "coach"
  | "company"
  | "assessment"
  | "next_call";

export type ProspectGroupOrder = "asc" | "desc" | "manual";

export type ProspectGroupSection = {
  key: string;
  label: string;
  prospects: ProspectRow[];
};

export const PROSPECT_GROUP_FIELDS: Array<{
  key: ProspectGroupField;
  label: string;
  coachOnly?: boolean;
}> = [
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "coach", label: "Coach", coachOnly: true },
  { key: "company", label: "Company" },
  { key: "assessment", label: "Assessment" },
  { key: "next_call", label: "Next call" },
];

export function prospectGroupIdentity(row: ProspectRow, field: ProspectGroupField): {
  key: string;
  label: string;
  rank: number;
} {
  switch (field) {
    case "status": {
      const value = row.status.value || "";
      const idx = (PROSPECT_STATUS_VALUES as readonly string[]).indexOf(value);
      return {
        key: `status:${value || "_"}`,
        label: row.status.label || humanizeProspectStatus(value) || "No status",
        rank: idx >= 0 ? idx : 100 + value.charCodeAt(0),
      };
    }
    case "source": {
      const label = resolveProspectSourceLabel(row);
      const kind = resolveProspectSourceKind(row);
      const idx = (PROSPECT_SOURCE_CHART_STACK_ORDER as readonly string[]).indexOf(
        kind
      );
      return {
        key: `source:${label.toLowerCase()}`,
        label,
        rank: idx >= 0 ? idx : 50,
      };
    }
    case "coach": {
      const label =
        formatProspectPersonName(row.coach_name ?? "") ||
        row.coach_business_name?.trim() ||
        "No coach";
      return {
        key: `coach:${row.coach_id || ""}`,
        label,
        rank: row.coach_id ? 0 : 1,
      };
    }
    case "company": {
      const label = row.business_name?.trim() || "No company";
      return {
        key: `company:${label.toLowerCase()}`,
        label,
        rank: row.business_name?.trim() ? 0 : 1,
      };
    }
    case "assessment": {
      const assessed = Boolean(row.last_assessed_at);
      return {
        key: assessed ? "assessment:yes" : "assessment:no",
        label: assessed ? "Assessed" : "Not assessed",
        rank: assessed ? 0 : 1,
      };
    }
    case "next_call": {
      const hasCall = Boolean(row.next_call?.start_time);
      return {
        key: hasCall ? "next_call:yes" : "next_call:no",
        label: hasCall ? "Has upcoming call" : "No upcoming call",
        rank: hasCall ? 0 : 1,
      };
    }
  }
}

export function groupProspectRows(
  rows: ProspectRow[],
  field: ProspectGroupField,
  order: ProspectGroupOrder,
  manualOrder: string[] = []
): ProspectGroupSection[] {
  const buckets = new Map<
    string,
    { label: string; rank: number; prospects: ProspectRow[] }
  >();

  for (const row of rows) {
    const ident = prospectGroupIdentity(row, field);
    const existing = buckets.get(ident.key);
    if (existing) {
      existing.prospects.push(row);
    } else {
      buckets.set(ident.key, {
        label: ident.label,
        rank: ident.rank,
        prospects: [row],
      });
    }
  }

  const sections: ProspectGroupSection[] = [];
  for (const [key, bucket] of buckets) {
    sections.push({ key, label: bucket.label, prospects: bucket.prospects });
  }

  const dir = order === "desc" ? -1 : 1;
  const manualIndex = new Map(manualOrder.map((key, i) => [key, i]));

  sections.sort((a, b) => {
    if (order === "manual") {
      const ia = manualIndex.has(a.key) ? (manualIndex.get(a.key) as number) : 10_000;
      const ib = manualIndex.has(b.key) ? (manualIndex.get(b.key) as number) : 10_000;
      if (ia !== ib) return ia - ib;
    }
    const aMeta = buckets.get(a.key)!;
    const bMeta = buckets.get(b.key)!;
    if (aMeta.rank !== bMeta.rank) {
      return (aMeta.rank - bMeta.rank) * (order === "manual" ? 1 : dir);
    }
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) * (order === "manual" ? 1 : dir);
  });

  return sections;
}

export const PROSPECTS_GROUP_STORAGE_KEY = "pc-prospects-list-group-v1";

export type PersistedProspectGrouping = {
  field: ProspectGroupField | null;
  order: ProspectGroupOrder;
  manualOrder: Partial<Record<ProspectGroupField, string[]>>;
};

export function defaultProspectGrouping(): PersistedProspectGrouping {
  return { field: null, order: "asc", manualOrder: {} };
}

export function loadProspectGrouping(): PersistedProspectGrouping {
  const fallback = defaultProspectGrouping();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PROSPECTS_GROUP_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedProspectGrouping>;
    const field = PROSPECT_GROUP_FIELDS.some((f) => f.key === parsed.field)
      ? (parsed.field as ProspectGroupField)
      : null;
    const order =
      parsed.order === "desc" || parsed.order === "manual" ? parsed.order : "asc";
    return {
      field,
      order,
      manualOrder:
        parsed.manualOrder && typeof parsed.manualOrder === "object"
          ? parsed.manualOrder
          : {},
    };
  } catch {
    return fallback;
  }
}

export function saveProspectGrouping(state: PersistedProspectGrouping) {
  try {
    window.localStorage.setItem(PROSPECTS_GROUP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
