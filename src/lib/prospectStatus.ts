import type { ProspectNextAction } from "./actionPlans/prospectFollowUp";
import type { ProspectNextCall } from "./prospectNextCall";

export const PROSPECT_STATUS_VALUES = [
  "new",
  "assessed",
  "call_booked",
  "call_confirmed",
  "showed",
  "no_show",
  "follow_up",
  "contacted",
  "qualified",
] as const;

export type ProspectStatusValue = (typeof PROSPECT_STATUS_VALUES)[number];

export type ProspectStatusDisplay = {
  value: ProspectStatusValue;
  label: string;
  isAuto: boolean;
};

export const PROSPECT_STATUS_LABELS: Record<ProspectStatusValue, string> = {
  new: "New",
  assessed: "Assessed",
  call_booked: "Call booked",
  call_confirmed: "Call confirmed",
  showed: "Showed",
  no_show: "No show",
  follow_up: "Follow-up",
  contacted: "Contacted",
  qualified: "Qualified",
};

export const PROSPECT_STATUS_OPTIONS = PROSPECT_STATUS_VALUES.map((value) => ({
  value,
  label: PROSPECT_STATUS_LABELS[value],
}));

export function prospectStatusBadgeClass(value: ProspectStatusValue): string {
  switch (value) {
    case "new":
      return "bg-orange-100 text-orange-800";
    case "assessed":
      return "bg-yellow-100 text-yellow-800";
    case "call_booked":
      return "bg-emerald-100 text-emerald-800";
    case "call_confirmed":
      return "bg-cyan-100 text-cyan-800";
    case "showed":
      return "bg-emerald-100 text-emerald-800";
    case "no_show":
      return "bg-amber-100 text-amber-900";
    case "follow_up":
      return "bg-slate-100 text-slate-700";
    case "contacted":
      return "bg-orange-100 text-orange-900";
    case "qualified":
      return "bg-green-100 text-green-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function isProspectStatusValue(value: string | null | undefined): value is ProspectStatusValue {
  return (
    value != null &&
    (PROSPECT_STATUS_VALUES as readonly string[]).includes(value)
  );
}

type ResolveInput = {
  prospect_status?: string | null;
  last_completed_at?: string | null;
  next_call?: ProspectNextCall | null;
  last_past_call_status?: string | null;
  next_action?: ProspectNextAction | null;
};

export function resolveAutoProspectStatus(input: ResolveInput): ProspectStatusValue {
  if (input.next_call?.start_time) {
    if (input.next_call.status_normalized === "confirmed") {
      return "call_confirmed";
    }
    return "call_booked";
  }

  if (input.last_past_call_status === "showed") return "showed";
  if (input.last_past_call_status === "noshow") return "no_show";

  if (input.next_action?.text?.trim()) return "follow_up";
  if (input.last_completed_at) return "assessed";
  return "new";
}

export function resolveProspectStatus(input: ResolveInput): ProspectStatusDisplay {
  const manual = input.prospect_status;
  if (isProspectStatusValue(manual)) {
    return {
      value: manual,
      label: PROSPECT_STATUS_LABELS[manual],
      isAuto: false,
    };
  }

  const autoValue = resolveAutoProspectStatus(input);
  return {
    value: autoValue,
    label: PROSPECT_STATUS_LABELS[autoValue],
    isAuto: true,
  };
}
