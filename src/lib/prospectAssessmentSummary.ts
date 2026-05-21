import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "./contactsSchemaSafeSelect";
import {
  DESIRED_OUTCOME_OTHER_VALUE,
  QUALIFYING_FIELDS,
  type QualifyingData,
  type QualifyingFieldDef,
  type QualifyingFieldId,
} from "./bossScorecardQuestions";

export type ProspectAssessmentSummary = {
  revenue: string | null;
  team_size: string | null;
  years_in_business: string | null;
  outcome: string | null;
  obstacles: string | null;
  preferred_support: string | null;
  boss_level: string | null;
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

export type LatestAssessmentSnapshot = {
  total_score: number;
  completed_at: string;
  summary: ProspectAssessmentSummary | null;
};

export async function loadLatestAssessmentsByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, LatestAssessmentSnapshot>> {
  if (contactIds.length === 0) return {};

  const { data, error } = await supabase
    .from("assessments")
    .select(
      "contact_id, total_score, completed_at, qualifying_data, boss_level"
    )
    .in("contact_id", contactIds)
    .order("completed_at", { ascending: false });

  if (error) {
    if (isMissingColumnError(error) || error.code === "42P01") {
      const { data: fallback, error: fallbackError } = await supabase
        .from("assessments")
        .select("contact_id, total_score, completed_at")
        .in("contact_id", contactIds)
        .order("completed_at", { ascending: false });

      if (fallbackError) {
        console.warn("loadLatestAssessmentsByContactId:", fallbackError);
        return {};
      }

      const byContact: Record<string, LatestAssessmentSnapshot> = {};
      for (const row of fallback ?? []) {
        const contactId = (row as { contact_id?: string }).contact_id;
        if (!contactId || byContact[contactId]) continue;
        byContact[contactId] = {
          total_score: (row as { total_score: number }).total_score,
          completed_at: (row as { completed_at: string }).completed_at,
          summary: null,
        };
      }
      return byContact;
    }

    console.warn("loadLatestAssessmentsByContactId:", error);
    return {};
  }

  const byContact: Record<string, LatestAssessmentSnapshot> = {};

  for (const row of data ?? []) {
    const contactId = (row as { contact_id?: string }).contact_id;
    if (!contactId || byContact[contactId]) continue;

    byContact[contactId] = {
      total_score: (row as { total_score: number }).total_score,
      completed_at: (row as { completed_at: string }).completed_at,
      summary: buildProspectAssessmentSummary({
        qualifying_data: (row as { qualifying_data?: Record<string, unknown> })
          .qualifying_data,
        boss_level: (row as { boss_level?: string | null }).boss_level,
      }),
    };
  }

  return byContact;
}
