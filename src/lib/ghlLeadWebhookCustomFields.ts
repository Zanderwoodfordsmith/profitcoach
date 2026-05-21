import { BOSS_LEVEL_NUMBERS, type BossLevelName } from "./bossScorecardColors";
import {
  computeScorecardFocusAreas,
  type ScorecardAnswers,
} from "./bossScorecardScores";
import type { QualifyingData } from "./bossScorecardQuestions";
import { formatQualifyingValue } from "./prospectAssessmentSummary";

/**
 * Flat top-level fields for GHL inbound webhook → custom field mapping.
 * Keys align with Profit Coach snapshot location custom field names.
 * Only included on `assessment_completed` (BOSS scorecard); not on email/phone capture.
 */
export type BossScorecardGhlCustomFields = {
  annual_business_revenue: string | null;
  business_team_size: string | null;
  years_in_business: string | null;
  boss_score: number | null;
  business_level_number: number | null;
  business_level_name: string | null;
  desired_outcome: string | null;
  tried_before: string | null;
  desired_support_type: string | null;
  additional_info: string | null;
  focus_area_1: string | null;
  focus_area_2: string | null;
  focus_area_3: string | null;
  report_link: string | null;
};

export function buildBossScorecardGhlCustomFields(input: {
  qualifying_data: QualifyingData;
  answers: ScorecardAnswers;
  boss_score: number;
  boss_level: string | null;
  open_text: string | null;
  report_link: string | null;
}): BossScorecardGhlCustomFields {
  const data = input.qualifying_data;
  const levelName = input.boss_level?.trim() ?? null;
  const business_level_number =
    levelName && levelName in BOSS_LEVEL_NUMBERS
      ? BOSS_LEVEL_NUMBERS[levelName as BossLevelName]
      : null;

  const focusAreas = computeScorecardFocusAreas(input.answers, 3);

  return {
    annual_business_revenue: formatQualifyingValue(
      "annual_revenue",
      data.annual_revenue,
      data
    ),
    business_team_size: formatQualifyingValue("team_size", data.team_size, data),
    years_in_business: formatQualifyingValue(
      "time_in_business",
      data.time_in_business,
      data
    ),
    boss_score: input.boss_score,
    business_level_number,
    business_level_name: levelName,
    desired_outcome: formatQualifyingValue(
      "desired_outcome",
      data.desired_outcome,
      data
    ),
    tried_before: formatQualifyingValue("obstacles", data.obstacles, data),
    desired_support_type: formatQualifyingValue(
      "preferred_solution",
      data.preferred_solution,
      data
    ),
    additional_info: input.open_text?.trim() || null,
    focus_area_1: focusAreas[0]?.areaName ?? null,
    focus_area_2: focusAreas[1]?.areaName ?? null,
    focus_area_3: focusAreas[2]?.areaName ?? null,
    report_link: input.report_link,
  };
}
