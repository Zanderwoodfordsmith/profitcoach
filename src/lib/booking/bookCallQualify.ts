/** Shared qualify answers for BookCallFlow + StartApplyPanel → GHL webhook. */

export const ROLE_OPTIONS = [
  {
    value: "Consultant",
    label: "Consultant",
    icon: "consultant",
  },
  {
    value: "Business owner",
    label: "Owner",
    icon: "owner",
  },
  {
    value: "Business coach",
    label: "Coach",
    icon: "coach",
  },
  {
    value: "Director / senior leader",
    label: "Director",
    icon: "director",
  },
  {
    value: "Other",
    label: "Other",
    icon: "other",
  },
] as const;

export const TIMING_OPTIONS = [
  { value: "Yes", label: "Yes", tone: "yes" },
  { value: "Maybe", label: "Maybe", tone: "maybe" },
  { value: "No", label: "No", tone: "no" },
] as const;

export const INVESTMENT_OPTIONS = [
  {
    value: "Yes, that works",
    label: "Yes, that works",
    tone: "yes",
  },
  {
    value: "No, I’m looking for something free or done for me",
    label: "No, looking for free",
    tone: "no",
  },
] as const;

export type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];
export type TimingValue = (typeof TIMING_OPTIONS)[number]["value"];
export type InvestmentValue = (typeof INVESTMENT_OPTIONS)[number]["value"];
export type RoleIcon = (typeof ROLE_OPTIONS)[number]["icon"];

export const ROLE_VALUES = new Set<string>(ROLE_OPTIONS.map((o) => o.value));
export const TIMING_VALUES = new Set<string>(TIMING_OPTIONS.map((o) => o.value));
export const INVESTMENT_VALUES = new Set<string>(INVESTMENT_OPTIONS.map((o) => o.value));
