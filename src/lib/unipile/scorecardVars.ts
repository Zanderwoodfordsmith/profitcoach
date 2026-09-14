import {
  BOSS_LEVEL_NUMBERS,
  type BossLevelName,
} from "@/lib/bossScorecardColors";
import {
  computeScorecardFocusAreas,
  type ScorecardAnswers,
} from "@/lib/bossScorecardScores";
import type { QualifyingData } from "@/lib/bossScorecardQuestions";
import { formatQualifyingValue } from "@/lib/prospectAssessmentSummary";
import { buildScorecardReportUrl } from "@/lib/scorecardReportLink";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveCoachSlug } from "@/lib/unipile/interest";

export type ScorecardOutreachVars = {
  boss_score: string;
  business_level_number: string;
  business_level_name: string;
  desired_outcome: string;
  focus_area_1: string;
  focus_area_2: string;
  focus_area_3: string;
  boss_score_report_link: string;
};

export async function loadScorecardOutreachVars(input: {
  coachId: string;
  contactId?: string | null;
}): Promise<ScorecardOutreachVars | null> {
  if (!input.contactId) return null;

  const { data } = await supabaseAdmin
    .from("assessments")
    .select(
      "total_score, answers, qualifying_data, boss_level, report_token"
    )
    .eq("contact_id", input.contactId)
    .eq("assessment_type", "boss_scorecard")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const levelName = (data.boss_level as string | null)?.trim() || "";
  const business_level_number =
    levelName && levelName in BOSS_LEVEL_NUMBERS
      ? String(BOSS_LEVEL_NUMBERS[levelName as BossLevelName])
      : "";

  const answers = (data.answers || {}) as ScorecardAnswers;
  const qualifying = (data.qualifying_data || {}) as QualifyingData;
  const focus = computeScorecardFocusAreas(answers, 3);

  const slug = await resolveCoachSlug(input.coachId);
  const token = (data.report_token as string | null)?.trim() || "";
  const reportLink =
    slug && token ? buildScorecardReportUrl(slug, token) : "";

  const desired =
    formatQualifyingValue("desired_outcome", qualifying.desired_outcome, qualifying) ||
    "";

  return {
    boss_score:
      data.total_score != null ? String(Math.round(Number(data.total_score))) : "",
    business_level_number,
    business_level_name: levelName,
    desired_outcome: desired,
    focus_area_1: focus[0]?.areaName ?? "",
    focus_area_2: focus[1]?.areaName ?? "",
    focus_area_3: focus[2]?.areaName ?? "",
    boss_score_report_link: reportLink,
  };
}
