import type { ProspectRow } from "@/lib/prospectRow";
import type { ProspectStatusValue } from "@/lib/prospectStatus";
import {
  visiblePipelineColumns,
  visibleSections,
  type PipelineColumnConfig,
  type PipelineLayout,
} from "@/lib/pipelineLayout";

export const PIPELINE_COLUMN_IDS = [
  "leads",
  "replied",
  "interested",
  "booked",
  "follow_up",
  "closed",
] as const;

export type PipelineColumnId = (typeof PIPELINE_COLUMN_IDS)[number] | string;

export const DEFAULT_PIPELINE_COLUMN_IDS: PipelineColumnId[] = [
  "replied",
  "interested",
  "booked",
  "follow_up",
  "closed",
];

export const BOOKED_SECTION_IDS = ["rebook", "upcoming"] as const;
export type BookedSectionId = (typeof BOOKED_SECTION_IDS)[number];

export const CLOSED_SECTION_IDS = ["won", "abandoned", "lost"] as const;
export type ClosedSectionId = (typeof CLOSED_SECTION_IDS)[number];

export const INTERESTED_SECTION_IDS = ["lead_magnet", "expressed"] as const;
export type InterestedSectionId = (typeof INTERESTED_SECTION_IDS)[number];

export const POOL_SECTION_IDS = ["not_started", "in_outreach"] as const;
export type PoolSectionId = (typeof POOL_SECTION_IDS)[number];

export const FOLLOW_UP_SECTION_IDS = [
  "overdue",
  "this_week",
  "this_month",
  "later",
  "no_date",
] as const;
export type FollowUpSectionId = (typeof FOLLOW_UP_SECTION_IDS)[number];

export type PipelineSectionId = string;

export const PIPELINE_COLUMN_LABELS: Record<string, string> = {
  leads: "Pool",
  replied: "Replied",
  interested: "Interested",
  booked: "Booked",
  follow_up: "Follow-up",
  closed: "Closed",
};

export const PIPELINE_COLUMN_DOT: Record<string, string> = {
  leads: "bg-slate-400",
  replied: "bg-violet-500",
  interested: "bg-rose-400",
  booked: "bg-sky-500",
  follow_up: "bg-amber-400",
  closed: "bg-slate-400",
};

const CUSTOM_COLUMN_DOTS = [
  "bg-violet-400",
  "bg-cyan-500",
  "bg-fuchsia-400",
  "bg-lime-500",
  "bg-indigo-400",
];

export function columnDotClass(id: string, index = 0): string {
  return PIPELINE_COLUMN_DOT[id] ?? CUSTOM_COLUMN_DOTS[index % CUSTOM_COLUMN_DOTS.length];
}

const STATUS_TO_COLUMN: Record<ProspectStatusValue, PipelineColumnId> = {
  leads: "leads",
  replied: "replied",
  interested: "interested",
  booked: "booked",
  rebook: "booked",
  follow_up: "follow_up",
  won: "closed",
  lost: "closed",
  abandoned: "closed",
};

export const COLUMN_DROP_STATUS: Record<string, string> = {
  leads: "leads",
  replied: "replied",
  interested: "interested",
  booked: "booked",
  follow_up: "follow_up",
  closed: "abandoned",
};

export const SECTION_DROP_STATUS: Record<string, string> = {
  rebook: "rebook",
  upcoming: "booked",
  won: "won",
  lost: "lost",
  abandoned: "abandoned",
  lead_magnet: "interested",
  expressed: "interested",
  not_started: "leads",
  in_outreach: "leads",
  overdue: "follow_up",
  this_week: "follow_up",
  this_month: "follow_up",
  later: "follow_up",
  no_date: "follow_up",
};

export function pipelineDropStatus(
  columnId: string,
  sectionId?: string
): string {
  if (sectionId && !sectionId.endsWith("_other")) {
    return SECTION_DROP_STATUS[sectionId] ?? sectionId;
  }
  return COLUMN_DROP_STATUS[columnId] ?? columnId;
}

export function pipelineColumnForProspect(
  row: ProspectRow,
  layout?: PipelineLayout
): string {
  const status = row.status.value;
  if (layout) {
    for (const col of layout.columns) {
      if (col.id === status) return col.id;
      if (col.sections.some((section) => section.id === status)) return col.id;
    }
  }
  return STATUS_TO_COLUMN[status as ProspectStatusValue] ?? "leads";
}

export function bookedSectionForProspect(row: ProspectRow): BookedSectionId {
  if (row.status.value === "rebook") return "rebook";
  if (row.next_call?.start_time) return "upcoming";
  if (row.status.value === "booked") return "upcoming";
  return "rebook";
}

export function closedSectionForProspect(row: ProspectRow): ClosedSectionId {
  if (row.status.value === "won") return "won";
  if (row.status.value === "lost") return "lost";
  return "abandoned";
}

export function interestedSectionForProspect(
  row: ProspectRow
): InterestedSectionId {
  if (row.last_assessed_at) return "lead_magnet";
  return "expressed";
}

export function poolSectionForProspect(row: ProspectRow): PoolSectionId {
  if (row.in_outreach) return "in_outreach";
  return "not_started";
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfIsoWeek(today: Date): Date {
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + mondayOffset + 6);
  return sunday;
}

export function followUpSectionForProspect(row: ProspectRow): FollowUpSectionId {
  const due = row.next_action?.dueAt?.trim() ?? "";
  if (!due) return "no_date";
  const date = parseDateOnly(due);
  if (!date) return "no_date";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date < startToday) return "overdue";
  if (date <= endOfIsoWeek(startToday)) return "this_week";
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (date <= monthEnd) return "this_month";
  return "later";
}

function sectionForProspect(
  col: PipelineColumnConfig,
  row: ProspectRow
): string | null {
  const visible = visibleSections(col);
  if (visible.length === 0) return null;
  if (visible.some((section) => section.id === row.status.value)) {
    return row.status.value;
  }
  if (col.id === "leads") return poolSectionForProspect(row);
  if (col.id === "interested") return interestedSectionForProspect(row);
  if (col.id === "booked") return bookedSectionForProspect(row);
  if (col.id === "closed") return closedSectionForProspect(row);
  if (col.id === "follow_up") return followUpSectionForProspect(row);
  return visible[0]?.id ?? null;
}

/** Infer Discovery vs Value session from calendar/title when present. */
export function prospectCallTypeLabel(row: ProspectRow): string | null {
  const raw = [row.next_call?.title, row.next_call?.calendar_name]
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

export function pipelineCardPillLabel(row: ProspectRow): string {
  if (row.status.value === "leads") {
    return row.in_outreach ? "In outreach" : "Not started";
  }
  if (row.status.value === "interested") {
    if (row.last_assessed_at) return "Lead magnet";
    return "Expressed";
  }
  if (row.status.value === "booked" || row.status.value === "rebook") {
    const callType = prospectCallTypeLabel(row);
    if (callType === "Value session" || callType === "Discovery") return callType;
    return row.status.value === "rebook" ? "Rebook" : "Booked";
  }
  return row.status.label;
}

export type PipelineBoardSection = {
  id: string;
  label: string;
  prospects: ProspectRow[];
};

export type PipelineBoardColumn = {
  id: string;
  label: string;
  dotClass: string;
  collapsible: boolean;
  prospects: ProspectRow[];
  sections?: PipelineBoardSection[];
};

function sortByName(a: ProspectRow, b: ProspectRow): number {
  return a.full_name.localeCompare(b.full_name, undefined, {
    sensitivity: "base",
  });
}

function sortFollowUp(a: ProspectRow, b: ProspectRow): number {
  const aDue = a.next_action?.dueAt ?? "";
  const bDue = b.next_action?.dueAt ?? "";
  if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
  if (aDue && !bDue) return -1;
  if (!aDue && bDue) return 1;
  return sortByName(a, b);
}

function sortColumnProspects(id: string, list: ProspectRow[]): ProspectRow[] {
  return id === "follow_up"
    ? list.slice().sort(sortFollowUp)
    : list.slice().sort(sortByName);
}

export function buildPipelineBoard(
  prospects: ProspectRow[],
  options?: { showLeads?: boolean; layout?: PipelineLayout }
): PipelineBoardColumn[] {
  const layout = options?.layout;
  const configs = layout
    ? visiblePipelineColumns(layout)
    : PIPELINE_COLUMN_IDS.filter((id) => options?.showLeads || id !== "leads").map(
        (id) =>
          ({
            id,
            label: PIPELINE_COLUMN_LABELS[id],
            collapsible: id === "leads" || id === "closed",
            system: true,
            sections: [],
          }) satisfies PipelineColumnConfig
      );

  const byColumn = new Map<string, ProspectRow[]>();
  for (const col of configs) byColumn.set(col.id, []);

  for (const row of prospects) {
    const col = pipelineColumnForProspect(row, layout);
    if (!byColumn.has(col)) continue;
    byColumn.get(col)!.push(row);
  }

  return configs.map((col, index) => {
    const list = sortColumnProspects(col.id, byColumn.get(col.id) ?? []);
    const sections = visibleSections(col);
    const builtSections =
      sections.length > 0
        ? sections.map((section) => ({
            id: section.id,
            label: section.label,
            prospects: list.filter(
              (row) => sectionForProspect(col, row) === section.id
            ),
          }))
        : undefined;

    if (builtSections) {
      const assigned = new Set<string>();
      for (const section of builtSections) {
        for (const row of section.prospects) assigned.add(row.id);
      }
      const leftovers = list.filter((row) => !assigned.has(row.id));
      if (leftovers.length > 0) {
        builtSections.push({
          id: `${col.id}_other`,
          label: "Other",
          prospects: leftovers,
        });
      }
    }

    return {
      id: col.id,
      label: col.label,
      dotClass: columnDotClass(col.id, index),
      collapsible: Boolean(col.collapsible),
      prospects: list,
      sections: builtSections,
    };
  });
}

export { DEFAULT_AVG_DEAL_AMOUNT } from "@/lib/pipelineLayout";

export function formatPipelineMoney(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function columnDealValue(
  dealCount: number,
  avgDealAmount: number
): number {
  return Math.max(0, dealCount) * Math.max(0, avgDealAmount);
}
