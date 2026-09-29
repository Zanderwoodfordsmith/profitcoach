import type {
  KnowledgeSource,
  PracticeKnowledgePayload,
  Sourced,
} from "./types";

export function emptyPracticePayload(): PracticeKnowledgePayload {
  return {
    identity: {
      phone: null,
      whatsapp: null,
      website: null,
      timezone: null,
      location: null,
      linkedin_url: null,
      web_address: null,
      practice_email: null,
      linkedin_visibility: null,
    },
    working_times: {
      hours_per_week: null,
      preferred_hours: null,
      prospect_call_hours: null,
      notification_channel: null,
    },
    practice: {
      delivery_model: null,
      delivery_format: null,
      min_fee: null,
      capacity: null,
      more_of: null,
      less_of: null,
      worth_building: null,
    },
    market: {
      industries_worked: null,
      roles_held: null,
      industries_understand: null,
      industries_credibility: null,
      industries_access: null,
      avoid: null,
      geography_pref: null,
      buyer_roles: null,
    },
    proof: {
      career_results: null,
      client_results: null,
      problems_asked: null,
      proudest: null,
      uniqueness: null,
      superpowers: null,
      evidence_notes: null,
    },
    review: {
      report_comments: null,
      decision_call_booked_at: null,
      notes: null,
      approved_pages: null,
      approved_sections: null,
    },
  };
}

export function sourced<T>(
  value: T,
  source: KnowledgeSource,
  at = new Date().toISOString()
): Sourced<T> {
  return { value, source, updated_at: at };
}

export function isFilledSourced(
  field: Sourced<unknown> | null | undefined
): boolean {
  if (!field) return false;
  const v = field.value;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some((item) => String(item ?? "").trim());
  return v != null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSourced<T>(
  prev: Sourced<T> | null,
  next: Sourced<T> | null | undefined
): Sourced<T> | null {
  if (next === undefined) return prev;
  if (next === null) return prev;
  if (!isFilledSourced(next) && isFilledSourced(prev)) return prev;
  return next;
}

function mergeGroup<T extends Record<string, Sourced<unknown> | null>>(
  prev: T,
  patch: Partial<T> | undefined
): T {
  if (!patch) return prev;
  const out = { ...prev };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const next = patch[key];
    if (next === undefined) continue;
    (out as Record<string, Sourced<unknown> | null>)[key as string] =
      mergeSourced(
        prev[key] as Sourced<unknown> | null,
        next as Sourced<unknown> | null
      );
  }
  return out;
}

export function mergePracticePayload(
  prev: PracticeKnowledgePayload,
  patch: Partial<PracticeKnowledgePayload> | null | undefined
): PracticeKnowledgePayload {
  if (!patch) return prev;
  return {
    identity: mergeGroup(prev.identity, patch.identity),
    working_times: mergeGroup(prev.working_times, patch.working_times),
    practice: mergeGroup(prev.practice, patch.practice),
    market: mergeGroup(prev.market, patch.market),
    proof: mergeGroup(prev.proof, patch.proof),
    review: mergeGroup(prev.review, patch.review),
  };
}

export function normalizePracticePayload(
  raw: unknown
): PracticeKnowledgePayload {
  const base = emptyPracticePayload();
  if (!isPlainObject(raw)) return base;
  return mergePracticePayload(base, raw as Partial<PracticeKnowledgePayload>);
}

export function textValue(field: Sourced<string> | null | undefined): string {
  return field?.value?.trim() ?? "";
}

export function listValue(
  field: Sourced<string[]> | null | undefined
): string[] {
  return (field?.value ?? []).map((v) => String(v).trim()).filter(Boolean);
}
