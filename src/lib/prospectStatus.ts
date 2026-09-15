import type { ProspectNextAction } from "./actionPlans/prospectFollowUp";
import type { ProspectNextCall } from "./prospectNextCall";

export const PROSPECT_STATUS_VALUES = [
  "leads",
  "replied",
  "interested",
  "booked",
  "rebook",
  "follow_up",
  "won",
  "abandoned",
  "lost",
] as const;

export type ProspectStatusValue = (typeof PROSPECT_STATUS_VALUES)[number];

/** Older stored values still read; writes use the canonical set above. */
const LEGACY_STATUS_MAP: Record<string, ProspectStatusValue> = {
  new: "leads",
  contacted: "leads",
  assessed: "interested",
  call_booked: "booked",
  call_confirmed: "booked",
  no_show: "rebook",
  showed: "rebook",
  qualified: "follow_up",
};

export type ProspectStatusDisplay = {
  value: string;
  label: string;
  isAuto: boolean;
};

export function humanizeProspectStatus(value: string): string {
  if ((PROSPECT_STATUS_VALUES as readonly string[]).includes(value)) {
    return PROSPECT_STATUS_LABELS[value as ProspectStatusValue];
  }
  return value
    .replace(/^(col|sec)_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || value;
}

export const PROSPECT_STATUS_LABELS: Record<ProspectStatusValue, string> = {
  leads: "Pool",
  replied: "Replied",
  interested: "Interested",
  booked: "Booked",
  rebook: "Rebook",
  follow_up: "Follow-up",
  won: "Won",
  abandoned: "Abandoned",
  lost: "Lost",
};

export const PROSPECT_STATUS_OPTIONS = PROSPECT_STATUS_VALUES.map((value) => ({
  value,
  label: PROSPECT_STATUS_LABELS[value],
}));

/** Statuses shown on the Prospects list — Pool (leads) stays on the Pool tab. */
export const PROSPECT_LIST_STATUS_OPTIONS = PROSPECT_STATUS_OPTIONS.filter(
  (option) => option.value !== "leads"
);

export function canonicalizeProspectStatus(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if ((PROSPECT_STATUS_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  return LEGACY_STATUS_MAP[trimmed] ?? trimmed;
}

export function isCanonicalProspectStatus(
  value: string
): value is ProspectStatusValue {
  return (PROSPECT_STATUS_VALUES as readonly string[]).includes(value);
}

export function prospectStatusBadgeClass(value: string): string {
  switch (value) {
    case "leads":
      return "bg-rose-50 text-rose-700";
    case "replied":
      return "bg-violet-50 text-violet-800";
    case "interested":
      return "bg-amber-50 text-amber-800";
    case "booked":
      return "bg-sky-50 text-sky-800";
    case "rebook":
      return "bg-orange-50 text-orange-800";
    case "follow_up":
      return "bg-slate-100 text-slate-700";
    case "won":
      return "bg-emerald-50 text-emerald-800";
    case "abandoned":
      return "bg-slate-100 text-slate-600";
    case "lost":
      return "bg-rose-50 text-rose-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

type ResolveInput = {
  prospect_status?: string | null;
  last_completed_at?: string | null;
  next_call?: ProspectNextCall | null;
  last_past_call_status?: string | null;
  next_action?: ProspectNextAction | null;
};

export function resolveAutoProspectStatus(input: ResolveInput): ProspectStatusValue {
  if (input.next_call?.start_time) return "booked";

  if (input.last_past_call_status === "noshow") return "rebook";
  if (input.last_past_call_status === "showed") return "rebook";

  if (input.next_action?.text?.trim()) return "follow_up";
  if (input.last_completed_at) return "interested";
  return "leads";
}

function liftLegacyTopOfFunnel(
  raw: string | null | undefined,
  canonical: ProspectStatusValue,
  input: ResolveInput
): ProspectStatusValue {
  const key = raw?.trim().toLowerCase() ?? "";
  const isLegacyTop = key === "new" || key === "contacted" || key === "assessed";
  if (!isLegacyTop) return canonical;
  if (input.next_call?.start_time) return "booked";
  if ((key === "new" || key === "contacted") && input.last_completed_at) {
    return "interested";
  }
  if (key === "assessed") return "interested";
  return canonical;
}

/** Replied is a triage inbox — leave it once a call is on the calendar. */
function liftRepliedWhenBooked(
  canonical: ProspectStatusValue,
  input: ResolveInput
): ProspectStatusValue {
  if (canonical === "replied" && input.next_call?.start_time) return "booked";
  return canonical;
}

/**
 * Auto-move inbound replies into Replied only from the top of the funnel.
 * Interested / booked / follow-up / closed are already a judgment — don't undo them.
 * Null status stays on auto-derived status (may already be booked or interested).
 */
export function shouldAutoMoveProspectToReplied(
  storedStatus: string | null | undefined
): boolean {
  return canonicalizeProspectStatus(storedStatus) === "leads";
}

export function resolveProspectStatus(input: ResolveInput): ProspectStatusDisplay {
  const canonical = canonicalizeProspectStatus(input.prospect_status);
  if (canonical) {
    if (isCanonicalProspectStatus(canonical)) {
      const value = liftRepliedWhenBooked(
        liftLegacyTopOfFunnel(input.prospect_status, canonical, input),
        input
      );
      return {
        value,
        label: PROSPECT_STATUS_LABELS[value],
        isAuto: false,
      };
    }
    return {
      value: canonical,
      label: humanizeProspectStatus(canonical),
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
