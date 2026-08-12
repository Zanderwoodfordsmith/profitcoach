import type { RoleIcon } from "@/lib/booking/bookCallQualify";
import { ROLE_OPTIONS } from "@/lib/booking/bookCallQualify";

/** Same choices as Let’s Talk “which best describes you”. */
export const PROGRAMME_INTAKE_SITUATIONS = ROLE_OPTIONS;

export type ProgrammeIntakeSituationIcon = RoleIcon;

/** Multi-select motivations / outcomes. */
export const PROGRAMME_INTAKE_GOALS = [
  { value: "income", label: "Income", icon: "income" as const },
  { value: "flexibility", label: "Flexibility", icon: "flexibility" as const },
  { value: "autonomy", label: "Autonomy", icon: "autonomy" as const },
  {
    value: "work_life_balance",
    label: "Balance",
    icon: "balance" as const,
  },
  { value: "impact", label: "Impact", icon: "impact" as const },
  { value: "pleasure", label: "Enjoyment", icon: "pleasure" as const },
] as const;

/** Labels omit “per week” — that lives in the question copy. */
export const PROGRAMME_INTAKE_TIME_COMMITMENTS = [
  {
    value: "under_2_hours",
    label: "Under 2 hrs",
    icon: "under2" as const,
  },
  {
    value: "2_5_hours_week",
    label: "2–5 hrs",
    icon: "h25" as const,
  },
  {
    value: "5_10_hours_week",
    label: "5–10 hrs",
    icon: "h510" as const,
  },
  {
    value: "10_15_hours_week",
    label: "10–15 hrs",
    icon: "h1015" as const,
  },
  {
    value: "15_plus_hours_week",
    label: "15+ hrs",
    icon: "h15" as const,
  },
] as const;

export type ProgrammeIntakeSituation =
  (typeof PROGRAMME_INTAKE_SITUATIONS)[number]["value"];
export type ProgrammeIntakeGoal =
  (typeof PROGRAMME_INTAKE_GOALS)[number]["value"];
export type ProgrammeIntakeTimeCommitment =
  (typeof PROGRAMME_INTAKE_TIME_COMMITMENTS)[number]["value"];

export type ProgrammeIntakePayload = {
  linkedinUrl?: string | null;
  situation?: ProgrammeIntakeSituation | null;
  /** Multi-select goals. */
  goals?: ProgrammeIntakeGoal[] | null;
  /** @deprecated single goal — prefer `goals` */
  goal?: ProgrammeIntakeGoal | null;
  timeCommitment?: ProgrammeIntakeTimeCommitment | null;
};
