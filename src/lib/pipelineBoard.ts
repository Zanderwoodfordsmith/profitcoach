import type { ProspectRow } from "@/lib/prospectRow";
import type { ProspectStatusValue } from "@/lib/prospectStatus";

/** Top-level Pipeline board columns (people, not deals). */
export const PIPELINE_COLUMN_IDS = [
  "new",
  "assessed",
  "calls",
  "follow_up",
  "qualified",
] as const;

export type PipelineColumnId = (typeof PIPELINE_COLUMN_IDS)[number];

/** Nested groups inside the Calls column only. */
export const CALLS_SECTION_IDS = [
  "upcoming",
  "no_show",
  "showed",
] as const;

export type CallsSectionId = (typeof CALLS_SECTION_IDS)[number];

export const PIPELINE_COLUMN_LABELS: Record<PipelineColumnId, string> = {
  new: "New",
  assessed: "Assessed",
  calls: "Calls",
  follow_up: "Follow-up",
  qualified: "Qualified",
};

export const CALLS_SECTION_LABELS: Record<CallsSectionId, string> = {
  upcoming: "Upcoming",
  no_show: "No-show — rebook",
  showed: "Showed — awaiting next",
};

/** Soft column tints (dashboard slate/sky, not Bond purple). */
export const PIPELINE_COLUMN_TINT: Record<PipelineColumnId, string> = {
  new: "bg-sky-50/80",
  assessed: "bg-amber-50/70",
  calls: "bg-emerald-50/70",
  follow_up: "bg-slate-100/80",
  qualified: "bg-green-50/80",
};

const STATUS_TO_COLUMN: Record<ProspectStatusValue, PipelineColumnId> = {
  new: "new",
  contacted: "new",
  assessed: "assessed",
  call_booked: "calls",
  call_confirmed: "calls",
  showed: "calls",
  no_show: "calls",
  follow_up: "follow_up",
  qualified: "qualified",
};

/** Manual status written when a card is dropped on a column. */
export const COLUMN_DROP_STATUS: Record<PipelineColumnId, ProspectStatusValue> =
  {
    new: "new",
    assessed: "assessed",
    calls: "call_booked",
    follow_up: "follow_up",
    qualified: "qualified",
  };

export function pipelineColumnForProspect(
  row: ProspectRow
): PipelineColumnId {
  return STATUS_TO_COLUMN[row.status.value] ?? "new";
}

export function callsSectionForProspect(row: ProspectRow): CallsSectionId {
  const status = row.status.value;
  if (status === "no_show") return "no_show";
  if (status === "showed") return "showed";
  if (row.next_call?.start_time) return "upcoming";
  if (status === "call_booked" || status === "call_confirmed") return "upcoming";
  return "showed";
}

/** Infer Discovery vs Value session from calendar/title when present. */
export function prospectCallTypeLabel(row: ProspectRow): string | null {
  const raw = [
    row.next_call?.title,
    row.next_call?.calendar_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!raw) return null;
  if (raw.includes("value")) return "Value session";
  if (raw.includes("discovery") || raw.includes("fit call")) return "Discovery";
  const name =
    row.next_call?.title?.trim() || row.next_call?.calendar_name?.trim();
  return name || null;
}

export type PipelineBoardColumn = {
  id: PipelineColumnId;
  label: string;
  tint: string;
  prospects: ProspectRow[];
  /** Only set for the Calls column. */
  sections?: Array<{
    id: CallsSectionId;
    label: string;
    prospects: ProspectRow[];
  }>;
};

function sortByName(a: ProspectRow, b: ProspectRow): number {
  return a.full_name.localeCompare(b.full_name, undefined, {
    sensitivity: "base",
  });
}

export function buildPipelineBoard(
  prospects: ProspectRow[]
): PipelineBoardColumn[] {
  const byColumn = new Map<PipelineColumnId, ProspectRow[]>();
  for (const id of PIPELINE_COLUMN_IDS) byColumn.set(id, []);

  for (const row of prospects) {
    const col = pipelineColumnForProspect(row);
    byColumn.get(col)!.push(row);
  }

  return PIPELINE_COLUMN_IDS.map((id) => {
    const list = (byColumn.get(id) ?? []).slice().sort(sortByName);
    if (id !== "calls") {
      return {
        id,
        label: PIPELINE_COLUMN_LABELS[id],
        tint: PIPELINE_COLUMN_TINT[id],
        prospects: list,
      };
    }

    const sections = CALLS_SECTION_IDS.map((sectionId) => ({
      id: sectionId,
      label: CALLS_SECTION_LABELS[sectionId],
      prospects: list
        .filter((row) => callsSectionForProspect(row) === sectionId)
        .sort(sortByName),
    }));

    return {
      id,
      label: PIPELINE_COLUMN_LABELS[id],
      tint: PIPELINE_COLUMN_TINT[id],
      prospects: list,
      sections,
    };
  });
}
