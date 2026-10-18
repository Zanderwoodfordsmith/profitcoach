import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isMissingColumnError } from "@/lib/contactsSchemaSafeSelect";
import { chunkArray, SUPABASE_IN_FILTER_CHUNK } from "@/lib/chunkArray";
import {
  getScorecardProgress,
  TOTAL_SCORECARD_STEPS,
} from "@/lib/bossScorecardQuestions";
import { resolveLandingStatContactMarks } from "@/lib/landingActors";
import type { LeadMagnetId } from "@/lib/leadMagnets/catalog";
import {
  EMPTY_STAGES,
  later,
  type MagnetAudience,
  type MagnetAudiencePerson,
} from "@/lib/leadMagnets/audienceTypes";
export {
  emptyMagnetAudience,
  MAGNET_STAGE_LABEL,
  MAGNET_STAGES,
  type MagnetAudience,
  type MagnetAudiencePerson,
  type MagnetStage,
} from "@/lib/leadMagnets/audienceTypes";

export type MagnetSignal = {
  id: string;
  full_name: string | null;
  email: string | null;
  business_name: string | null;
  optedInAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  score: number | null;
  scoreAt: string | null;
  screen: number | null;
  progressAt: string | null;
};

type ContactAudienceRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  business_name: string | null;
  created_at: string | null;
  scorecard_last_screen: number | null;
  scorecard_progress_at: string | null;
};

export function magnetAssessmentType(
  magnetId: LeadMagnetId
): "boss_scorecard" | "diagnostic_50" {
  return magnetId === "boss-score" ? "boss_scorecard" : "diagnostic_50";
}

function finiteScore(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function scorecardProgressFromScreen(
  screen: number | null | undefined
): { step: number; total: number } | null {
  if (screen == null || !Number.isFinite(screen) || screen < 1) return null;
  const { currentStep } = getScorecardProgress(screen);
  if (currentStep < 1) return null;
  return {
    step: Math.min(currentStep, TOTAL_SCORECARD_STEPS),
    total: TOTAL_SCORECARD_STEPS,
  };
}

export function timestampInRange(
  at: string | null,
  from: string | null,
  to: string | null
): boolean {
  if (!from && !to) return true;
  if (!at) return false;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return false;
  if (from) {
    const start = Date.parse(from);
    if (!Number.isNaN(start) && time < start) return false;
  }
  if (to) {
    const end = Date.parse(to);
    if (!Number.isNaN(end) && time > end) return false;
  }
  return true;
}

/**
 * One person, one stage. Completed wins over started, started wins over opted in.
 * Boss Pro ignores screen progress — that column is the short scorecard only.
 */
export function personFromMagnetSignals(
  signal: MagnetSignal,
  options: { trackProgress: boolean }
): MagnetAudiencePerson | null {
  const score = finiteScore(signal.score);
  const progress = options.trackProgress
    ? scorecardProgressFromScreen(signal.screen)
    : null;
  const startedAt = later(
    signal.startedAt,
    options.trackProgress ? signal.progressAt : null
  );
  const completed =
    score != null || Boolean(signal.scoreAt) || Boolean(signal.finishedAt);

  const base = {
    id: signal.id,
    full_name: signal.full_name,
    email: signal.email,
    business_name: signal.business_name,
  };

  if (completed) {
    return {
      ...base,
      stage: "completed",
      score,
      progress_step: null,
      progress_total: null,
      at: signal.scoreAt ?? signal.finishedAt,
    };
  }

  if (startedAt || progress) {
    return {
      ...base,
      stage: "started",
      score: null,
      progress_step: progress?.step ?? null,
      progress_total: progress ? progress.total : null,
      at: startedAt,
    };
  }

  if (signal.optedInAt) {
    return {
      ...base,
      stage: "opted_in",
      score: null,
      progress_step: null,
      progress_total: null,
      at: signal.optedInAt,
    };
  }

  return null;
}

export function summarizeMagnetAudience(input: {
  people: MagnetAudiencePerson[];
  uniqueViews: number;
  optIns: number;
}): MagnetAudience {
  const stages = { ...EMPTY_STAGES };
  const people = [...input.people].sort((a, b) => {
    const aTime = a.at ? Date.parse(a.at) : 0;
    const bTime = b.at ? Date.parse(b.at) : 0;
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });

  for (const person of people) {
    stages[person.stage] += 1;
  }

  return {
    unique_views: input.uniqueViews,
    opt_ins: input.optIns,
    stages,
    started_total: stages.started + stages.completed,
    people,
  };
}

function markMap(marks: { id: string; at: string }[]): Map<string, string> {
  return new Map(marks.map((mark) => [mark.id, mark.at]));
}

async function loadViewSessionIds(
  coachSlug: string,
  from: string | null,
  to: string | null
): Promise<number> {
  const sessions = new Set<string>();
  const pageSize = 1000;

  for (let offset = 0; offset < 20000; offset += pageSize) {
    let query = supabaseAdmin
      .from("landing_events")
      .select("session_id")
      .eq("coach_slug", coachSlug)
      .eq("event_type", "view")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, error } = await query;
    if (error) {
      console.error("magnet audience views:", error.message);
      break;
    }
    const batch = data ?? [];
    for (const row of batch) {
      const sessionId = (row as { session_id?: string | null }).session_id;
      if (sessionId) sessions.add(sessionId);
    }
    if (batch.length < pageSize) break;
  }

  return sessions.size;
}

async function loadCompletedAssessments(
  contactIds: string[],
  assessmentType: "boss_scorecard" | "diagnostic_50"
): Promise<Map<string, { score: number; at: string }>> {
  const byContact = new Map<string, { score: number; at: string }>();
  if (contactIds.length === 0) return byContact;

  for (const idChunk of chunkArray(contactIds, SUPABASE_IN_FILTER_CHUNK)) {
    const { data, error } = await supabaseAdmin
      .from("assessments")
      .select("contact_id, total_score, completed_at")
      .in("contact_id", idChunk)
      .eq("assessment_type", assessmentType)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("magnet audience assessments:", error.message);
      continue;
    }

    for (const row of data ?? []) {
      const contactId = (row as { contact_id?: string | null }).contact_id;
      const completedAt = (row as { completed_at?: string | null }).completed_at;
      const score = finiteScore(
        (row as { total_score?: number | null }).total_score
      );
      if (!contactId || !completedAt || byContact.has(contactId)) continue;
      byContact.set(contactId, { score: score ?? 0, at: completedAt });
    }
  }

  return byContact;
}

async function loadFunnelContacts(
  coachId: string,
  assessmentType: "boss_scorecard" | "diagnostic_50",
  trackProgress: boolean
): Promise<ContactAudienceRow[]> {
  const select = trackProgress ? CONTACT_WITH_PROGRESS : CONTACT_PLAIN;
  const first = await supabaseAdmin
    .from("contacts")
    .select(select)
    .eq("coach_id", coachId)
    .eq("prospect_funnel", assessmentType);

  if (first.error && trackProgress && isMissingColumnError(first.error)) {
    const fallback = await supabaseAdmin
      .from("contacts")
      .select(CONTACT_PLAIN)
      .eq("coach_id", coachId)
      .eq("prospect_funnel", assessmentType);
    if (fallback.error) {
      console.error("magnet audience funnel:", fallback.error.message);
      return [];
    }
    return (fallback.data ?? []).map((row) =>
      asContactRow(row as unknown as Record<string, unknown>)
    );
  }

  if (first.error) {
    console.error("magnet audience funnel:", first.error.message);
    return [];
  }

  return (first.data ?? []).map((row) =>
    asContactRow(row as unknown as Record<string, unknown>)
  );
}

const CONTACT_WITH_PROGRESS =
  "id, full_name, email, business_name, created_at, scorecard_last_screen, scorecard_progress_at";
const CONTACT_PLAIN = "id, full_name, email, business_name, created_at";

function asContactRow(row: Record<string, unknown>): ContactAudienceRow {
  const screen = row.scorecard_last_screen;
  return {
    id: String(row.id),
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    email: typeof row.email === "string" ? row.email : null,
    business_name:
      typeof row.business_name === "string" ? row.business_name : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    scorecard_last_screen:
      typeof screen === "number" && Number.isFinite(screen) ? screen : null,
    scorecard_progress_at:
      typeof row.scorecard_progress_at === "string"
        ? row.scorecard_progress_at
        : null,
  };
}

async function loadContactsByIds(
  coachId: string,
  ids: string[],
  trackProgress: boolean
): Promise<Map<string, ContactAudienceRow>> {
  const byId = new Map<string, ContactAudienceRow>();
  if (ids.length === 0) return byId;

  let select = trackProgress ? CONTACT_WITH_PROGRESS : CONTACT_PLAIN;

  for (const idChunk of chunkArray(ids, SUPABASE_IN_FILTER_CHUNK)) {
    const first = await supabaseAdmin
      .from("contacts")
      .select(select)
      .eq("coach_id", coachId)
      .in("id", idChunk);

    let rows = first.data as unknown[] | null;
    if (first.error && trackProgress && isMissingColumnError(first.error)) {
      select = CONTACT_PLAIN;
      const fallback = await supabaseAdmin
        .from("contacts")
        .select(CONTACT_PLAIN)
        .eq("coach_id", coachId)
        .in("id", idChunk);
      if (fallback.error) {
        console.error("magnet audience contacts:", fallback.error.message);
        continue;
      }
      rows = fallback.data as unknown[] | null;
    } else if (first.error) {
      console.error("magnet audience contacts:", first.error.message);
      continue;
    }

    for (const row of rows ?? []) {
      const contact = asContactRow(row as Record<string, unknown>);
      byId.set(contact.id, contact);
    }
  }

  return byId;
}

async function loadProgressContacts(
  coachId: string
): Promise<ContactAudienceRow[]> {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select(CONTACT_WITH_PROGRESS)
    .eq("coach_id", coachId)
    .not("scorecard_last_screen", "is", null);

  if (error) {
    if (!isMissingColumnError(error)) {
      console.error("magnet audience progress:", error.message);
    }
    return [];
  }

  return (data ?? []).map((row) =>
    asContactRow(row as unknown as Record<string, unknown>)
  );
}

export async function loadMagnetAudience(input: {
  coachId: string;
  coachSlug: string | null;
  magnetId: LeadMagnetId;
  from?: string | null;
  to?: string | null;
}): Promise<MagnetAudience> {
  const from = input.from?.trim() || null;
  const to = input.to?.trim() || null;
  const trackProgress = input.magnetId === "boss-score";
  const assessmentType = magnetAssessmentType(input.magnetId);
  const slug = input.coachSlug?.trim() || null;

  const [optIns, starts, finishes, funnelContacts, progressContacts, uniqueViews] =
    await Promise.all([
      slug
        ? resolveLandingStatContactMarks(slug, input.coachId, "opt_in")
        : Promise.resolve([]),
      slug
        ? resolveLandingStatContactMarks(slug, input.coachId, "start")
        : Promise.resolve([]),
      slug
        ? resolveLandingStatContactMarks(slug, input.coachId, "finish")
        : Promise.resolve([]),
      loadFunnelContacts(input.coachId, assessmentType, trackProgress),
      trackProgress
        ? loadProgressContacts(input.coachId)
        : Promise.resolve([]),
      slug && trackProgress
        ? loadViewSessionIds(slug, from, to)
        : Promise.resolve(0),
    ]);

  const optedInAt = markMap(optIns);
  const startedAt = markMap(starts);
  const finishedAt = markMap(finishes);

  const ids = new Set<string>([
    ...optedInAt.keys(),
    ...startedAt.keys(),
    ...finishedAt.keys(),
    ...funnelContacts.map((row) => row.id),
    ...progressContacts.map((row) => row.id),
  ]);

  const contacts = await loadContactsByIds(
    input.coachId,
    [...ids],
    trackProgress
  );
  for (const row of funnelContacts) contacts.set(row.id, row);
  for (const row of progressContacts) contacts.set(row.id, row);

  const assessments = await loadCompletedAssessments([...ids], assessmentType);
  const funnelIds = new Set(funnelContacts.map((row) => row.id));

  const people: MagnetAudiencePerson[] = [];
  for (const id of ids) {
    const contact = contacts.get(id);
    if (!contact) continue;
    const assessment = assessments.get(id);
    const person = personFromMagnetSignals(
      {
        id,
        full_name: contact.full_name,
        email: contact.email,
        business_name: contact.business_name,
        optedInAt: optedInAt.get(id) ?? null,
        startedAt:
          startedAt.get(id) ??
          (funnelIds.has(id) && !assessments.has(id)
            ? contact.created_at
            : null),
        finishedAt: finishedAt.get(id) ?? null,
        score: assessment?.score ?? null,
        scoreAt: assessment?.at ?? null,
        screen: contact.scorecard_last_screen,
        progressAt: contact.scorecard_progress_at,
      },
      { trackProgress }
    );
    if (!person) continue;
    if (!timestampInRange(person.at, from, to)) continue;
    people.push(person);
  }

  const optInCount = optIns.filter((mark) =>
    timestampInRange(mark.at, from, to)
  ).length;

  return summarizeMagnetAudience({
    people,
    uniqueViews,
    optIns: optInCount,
  });
}
