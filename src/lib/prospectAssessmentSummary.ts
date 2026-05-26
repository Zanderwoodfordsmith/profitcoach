import type { SupabaseClient } from "@supabase/supabase-js";
import { getTotalScore } from "./bossScores";
import { isMissingColumnError } from "./contactsSchemaSafeSelect";
import {
  DESIRED_OUTCOME_OTHER_VALUE,
  QUALIFYING_FIELDS,
  type QualifyingData,
  type QualifyingFieldDef,
  type QualifyingFieldId,
} from "./bossScorecardQuestions";
import { latestProspectAssessmentAt } from "./prospectRow";

export type ProspectAssessmentSummary = {
  revenue: string | null;
  team_size: string | null;
  years_in_business: string | null;
  outcome: string | null;
  obstacles: string | null;
  preferred_support: string | null;
  boss_level: string | null;
};

export type ScorecardSnapshot = {
  total_score: number;
  completed_at: string;
  report_token: string | null;
  summary: ProspectAssessmentSummary | null;
};

export type PremiumDiagnosticSnapshot = {
  total_score: number;
  completed_at: string;
};

export type PremiumSessionSnapshot = {
  total_score: number;
  updated_at: string | null;
};

const FIELD_BY_ID = new Map<QualifyingFieldId, QualifyingFieldDef>(
  QUALIFYING_FIELDS.map((field) => [field.id, field])
);

function optionLabel(field: QualifyingFieldDef, value: string): string | null {
  return field.options.find((option) => option.value === value)?.label ?? null;
}

export function formatQualifyingValue(
  fieldId: QualifyingFieldId,
  raw: string | string[] | null | undefined,
  data: QualifyingData
): string | null {
  if (raw == null) return null;

  const field = FIELD_BY_ID.get(fieldId);
  if (!field) return null;

  if (field.multi && Array.isArray(raw)) {
    const labels = raw
      .map((value) => optionLabel(field, value) ?? value)
      .filter(Boolean);
    return labels.length > 0 ? labels.join(", ") : null;
  }

  if (typeof raw !== "string" || !raw.trim()) return null;

  if (
    fieldId === "desired_outcome" &&
    raw === DESIRED_OUTCOME_OTHER_VALUE
  ) {
    const other = data.desired_outcome_other;
    if (typeof other === "string" && other.trim()) return other.trim();
    return optionLabel(field, raw);
  }

  return optionLabel(field, raw) ?? raw.replace(/_/g, " ");
}

export function buildProspectAssessmentSummary(input: {
  qualifying_data?: Record<string, unknown> | null;
  boss_level?: string | null;
}): ProspectAssessmentSummary | null {
  const data = (input.qualifying_data ?? {}) as QualifyingData;
  const hasQualifying = QUALIFYING_FIELDS.some((field) => {
    const value = data[field.id];
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === "string" && value.trim().length > 0;
  });
  const bossLevel =
    typeof input.boss_level === "string" && input.boss_level.trim()
      ? input.boss_level.trim()
      : null;

  if (!hasQualifying && !bossLevel) return null;

  return {
    revenue: formatQualifyingValue("annual_revenue", data.annual_revenue, data),
    team_size: formatQualifyingValue("team_size", data.team_size, data),
    years_in_business: formatQualifyingValue(
      "time_in_business",
      data.time_in_business,
      data
    ),
    outcome: formatQualifyingValue(
      "desired_outcome",
      data.desired_outcome,
      data
    ),
    obstacles: formatQualifyingValue("obstacles", data.obstacles, data),
    preferred_support: formatQualifyingValue(
      "preferred_solution",
      data.preferred_solution,
      data
    ),
    boss_level: bossLevel,
  };
}

function normalizeSessionAnswers(
  raw: unknown
): Record<string, 0 | 1 | 2> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const answers: Record<string, 0 | 1 | 2> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== "string") continue;
    if (value === 0 || value === 1 || value === 2) {
      answers[key] = value;
    }
  }
  return Object.keys(answers).length > 0 ? answers : null;
}

function sessionScoreFromAnswers(raw: unknown): PremiumSessionSnapshot | null {
  const answers = normalizeSessionAnswers(raw);
  if (!answers) return null;
  return { total_score: getTotalScore(answers), updated_at: null };
}

export async function loadLatestScorecardByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, ScorecardSnapshot>> {
  if (contactIds.length === 0) return {};

  const { data, error } = await supabase
    .from("assessments")
    .select(
      "contact_id, total_score, completed_at, qualifying_data, boss_level, report_token, assessment_type"
    )
    .in("contact_id", contactIds)
    .eq("assessment_type", "boss_scorecard")
    .order("completed_at", { ascending: false });

  if (error) {
    if (isMissingColumnError(error) || error.code === "42P01") {
      return {};
    }
    console.warn("loadLatestScorecardByContactId:", error);
    return {};
  }

  const byContact: Record<string, ScorecardSnapshot> = {};
  for (const row of data ?? []) {
    const contactId = (row as { contact_id?: string }).contact_id;
    if (!contactId || byContact[contactId]) continue;

    byContact[contactId] = {
      total_score: (row as { total_score: number }).total_score,
      completed_at: (row as { completed_at: string }).completed_at,
      report_token:
        typeof (row as { report_token?: string | null }).report_token ===
        "string"
          ? (row as { report_token: string }).report_token
          : null,
      summary: buildProspectAssessmentSummary({
        qualifying_data: (row as { qualifying_data?: Record<string, unknown> })
          .qualifying_data,
        boss_level: (row as { boss_level?: string | null }).boss_level,
      }),
    };
  }

  return byContact;
}

export async function loadLatestPremiumDiagnosticByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, PremiumDiagnosticSnapshot>> {
  if (contactIds.length === 0) return {};

  const { data, error } = await supabase
    .from("assessments")
    .select("contact_id, total_score, completed_at, assessment_type")
    .in("contact_id", contactIds)
    .eq("assessment_type", "diagnostic_50")
    .order("completed_at", { ascending: false });

  if (error) {
    if (isMissingColumnError(error) || error.code === "42P01") {
      return {};
    }
    console.warn("loadLatestPremiumDiagnosticByContactId:", error);
    return {};
  }

  const byContact: Record<string, PremiumDiagnosticSnapshot> = {};
  for (const row of data ?? []) {
    const contactId = (row as { contact_id?: string }).contact_id;
    if (!contactId || byContact[contactId]) continue;

    byContact[contactId] = {
      total_score: (row as { total_score: number }).total_score,
      completed_at: (row as { completed_at: string }).completed_at,
    };
  }

  return byContact;
}

export async function loadPremiumSessionScoresByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, PremiumSessionSnapshot>> {
  if (contactIds.length === 0) return {};

  const { data, error } = await supabase
    .from("contacts")
    .select("id, session_answers, updated_at")
    .in("id", contactIds);

  if (error) {
    if (isMissingColumnError(error)) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("contacts")
        .select("id, session_answers")
        .in("id", contactIds);

      if (fallbackError) {
        console.warn("loadPremiumSessionScoresByContactId:", fallbackError);
        return {};
      }

      const byContact: Record<string, PremiumSessionSnapshot> = {};
      for (const row of fallback ?? []) {
        const contactId = (row as { id?: string }).id;
        if (!contactId) continue;
        const session = sessionScoreFromAnswers(
          (row as { session_answers?: unknown }).session_answers
        );
        if (session) byContact[contactId] = session;
      }
      return byContact;
    }

    console.warn("loadPremiumSessionScoresByContactId:", error);
    return {};
  }

  const byContact: Record<string, PremiumSessionSnapshot> = {};
  for (const row of data ?? []) {
    const contactId = (row as { id?: string }).id;
    if (!contactId) continue;
    const session = sessionScoreFromAnswers(
      (row as { session_answers?: unknown }).session_answers
    );
    if (!session) continue;
    session.updated_at =
      typeof (row as { updated_at?: string | null }).updated_at === "string"
        ? (row as { updated_at: string }).updated_at
        : null;
    byContact[contactId] = session;
  }

  return byContact;
}

/** @deprecated Use loadLatestScorecardByContactId for BOSS Score column data. */
export type LatestAssessmentSnapshot = {
  total_score: number;
  completed_at: string;
  summary: ProspectAssessmentSummary | null;
};

/** @deprecated Use typed scorecard / premium loaders instead. */
export async function loadLatestAssessmentsByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, LatestAssessmentSnapshot>> {
  const scorecards = await loadLatestScorecardByContactId(supabase, contactIds);
  const byContact: Record<string, LatestAssessmentSnapshot> = {};
  for (const [contactId, snapshot] of Object.entries(scorecards)) {
    byContact[contactId] = {
      total_score: snapshot.total_score,
      completed_at: snapshot.completed_at,
      summary: snapshot.summary,
    };
  }
  return byContact;
}

export async function loadLatestProspectAssessmentAtByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, string>> {
  if (contactIds.length === 0) return {};

  const [scorecards, diagnostics, sessions] = await Promise.all([
    loadLatestScorecardByContactId(supabase, contactIds),
    loadLatestPremiumDiagnosticByContactId(supabase, contactIds),
    loadPremiumSessionScoresByContactId(supabase, contactIds),
  ]);

  const byContact: Record<string, string> = {};
  for (const contactId of contactIds) {
    const scorecardAt = scorecards[contactId]?.completed_at ?? null;
    const diagnosticAt = diagnostics[contactId]?.completed_at ?? null;
    const sessionAt = sessions[contactId]?.updated_at ?? null;
    const latest = latestProspectAssessmentAt(
      scorecardAt,
      latestProspectAssessmentAt(diagnosticAt, sessionAt)
    );
    if (latest) byContact[contactId] = latest;
  }

  return byContact;
}
