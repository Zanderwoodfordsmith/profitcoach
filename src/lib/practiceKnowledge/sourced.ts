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
      address: null,
      address_line2: null,
      postcode: null,
      country: null,
      linkedin_url: null,
      web_address: null,
      practice_email: null,
      linkedin_visibility: null,
      linkedin_headline: null,
      linkedin_about: null,
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
      payment_terms: null,
      guarantee: null,
      guarantee_terms: null,
      session_rhythm: null,
      offer_outcome: null,
      more_of: null,
      less_of: null,
      help_with: null,
      offer_timeframe: null,
      worth_building: null,
      tone: null,
      voice_sounds_like: null,
      voice_never: null,
      voice_notes: null,
      voice_known_for: null,
      voice_coaching_style: null,
      voice_values: null,
      voice_qualities: null,
      voice_like_in_people: null,
      voice_dislike_in_people: null,
      voice_pet_peeves: null,
      voice_favourite_book: null,
      voice_favourite_film: null,
      voice_hobbies: null,
      voice_stories: null,
      newsletter_cadence: null,
      newsletter_name: null,
      newsletter_description: null,
      newsletter_audience: null,
      newsletter_cta: null,
      newsletter_added: null,
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
    client: {
      characteristics: null,
      habitat: null,
      psychographics: null,
      pains_now: null,
      desires_now: null,
      pains_later: null,
      desires_later: null,
      stuck: null,
      hears: null,
      sees: null,
      says: null,
      thinks: null,
      words_use: null,
      words_avoid: null,
      frustrations: null,
      buying_triggers: null,
      objections: null,
      trust: null,
      inner_voice: null,
      ready_to_act: null,
      why_you: null,
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
      bca_approved_sections: null,
      section_status: null,
      status_log: null,
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
  // A coach or admin edit can clear a field. An import or interview that sends
  // an empty value must not wipe something already written.
  const explicit = next.source === "coach_edit" || next.source === "admin";
  if (!explicit && !isFilledSourced(next) && isFilledSourced(prev)) return prev;
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
    client: mergeGroup(prev.client, patch.client),
    proof: mergeGroup(prev.proof, patch.proof),
    review: mergeGroup(prev.review, patch.review),
  };
}

export function normalizePracticePayload(
  raw: unknown
): PracticeKnowledgePayload {
  const base = emptyPracticePayload();
  if (!isPlainObject(raw)) return base;
  return foldRetiredAnswers(mergePracticePayload(base, raw as Partial<PracticeKnowledgePayload>));
}

type AnyField = Sourced<unknown> | null | undefined;

/** Answers as lines: lists stay lists, text is one line, table rows become one line each. */
function linesOf(field: AnyField, row?: (r: Record<string, unknown>) => string): string[] {
  const v = field?.value;
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => (item && typeof item === "object" ? (row ? row(item as Record<string, unknown>) : "") : String(item ?? "")))
    .map((s) => s.trim())
    .filter(Boolean);
}

const cells = (...keys: string[]) => (r: Record<string, unknown>) =>
  keys.map((k) => String(r[k] ?? "").trim()).filter(Boolean).join(". ");

/**
 * Who You Help used to ask for the same person in 26 boxes. It now asks in 11.
 * Answers in a retired box move into the box that replaced it, once, and the
 * retired box is cleared with an explicit edit so the next save removes it.
 * Lines already in the kept box are not added twice, so this is safe to rerun.
 */
const FOLDS: {
  into: [keyof PracticeKnowledgePayload, string];
  kind: "list" | "text";
  from: { path: [keyof PracticeKnowledgePayload, string]; row?: (r: Record<string, unknown>) => string; empty: unknown }[];
}[] = [
  {
    into: ["market", "industries_credibility"],
    kind: "list",
    from: [
      { path: ["market", "industries_understand"], empty: [] },
      { path: ["market", "industries_access"], empty: [] },
    ],
  },
  {
    into: ["client", "characteristics"],
    kind: "list",
    from: [
      { path: ["client", "habitat"], empty: [] },
      { path: ["client", "psychographics"], empty: [] },
    ],
  },
  {
    into: ["client", "pains_now"],
    kind: "list",
    from: [
      { path: ["client", "pains_later"], empty: [] },
      { path: ["client", "frustrations"], empty: [] },
      { path: ["client", "stuck"], row: cells("problem", "consequence", "awake"), empty: [] },
    ],
  },
  {
    into: ["client", "desires_now"],
    kind: "list",
    from: [{ path: ["client", "desires_later"], empty: [] }],
  },
  {
    into: ["client", "says"],
    kind: "list",
    from: [
      { path: ["client", "hears"], empty: [] },
      { path: ["client", "sees"], empty: [] },
      { path: ["client", "thinks"], empty: [] },
      { path: ["client", "words_use"], empty: [] },
      { path: ["client", "inner_voice"], empty: "" },
      { path: ["client", "ready_to_act"], empty: "" },
    ],
  },
  {
    into: ["client", "why_you"],
    kind: "text",
    from: [{ path: ["client", "trust"], row: cells("authority", "social_proof", "scarcity"), empty: [] }],
  },
];

export function foldRetiredAnswers(payload: PracticeKnowledgePayload): PracticeKnowledgePayload {
  let out = payload;
  for (const fold of FOLDS) {
    const groupOf = (g: keyof PracticeKnowledgePayload) => out[g] as unknown as Record<string, AnyField>;
    const moving = fold.from.filter((f) => linesOf(groupOf(f.path[0])[f.path[1]], f.row).length > 0);
    if (!moving.length) continue;

    const kept = groupOf(fold.into[0])[fold.into[1]];
    const lines = linesOf(kept);
    const seen = new Set(lines.map((l) => l.toLowerCase()));
    let latest = kept?.updated_at ?? "";
    let source = kept && isFilledSourced(kept) ? kept.source : undefined;
    const patch: Record<string, Record<string, Sourced<unknown>>> = {};
    for (const f of moving) {
      const field = groupOf(f.path[0])[f.path[1]]!;
      for (const line of linesOf(field, f.row)) {
        if (seen.has(line.toLowerCase())) continue;
        seen.add(line.toLowerCase());
        lines.push(line);
      }
      if (field.updated_at > latest) latest = field.updated_at;
      source ??= field.source;
      (patch[f.path[0]] ??= {})[f.path[1]] = sourced(f.empty, "coach_edit", field.updated_at);
    }
    (patch[fold.into[0]] ??= {})[fold.into[1]] = sourced(
      fold.kind === "text" ? lines.join("\n") : lines,
      source ?? "coach_edit",
      latest || new Date().toISOString()
    );
    out = mergePracticePayload(out, patch as Partial<PracticeKnowledgePayload>);
  }
  return out;
}

export function textValue(field: Sourced<string> | null | undefined): string {
  return field?.value?.trim() ?? "";
}

export function listValue(
  field: Sourced<string[]> | null | undefined
): string[] {
  return (field?.value ?? []).map((v) => String(v).trim()).filter(Boolean);
}
