/**
 * Ava's call has two protocols. Intake is the first call after someone joins:
 * she collects the facts only they know, then sends them to book Pam. Follow-up
 * is the same voice afterwards, and it only touches what is still open.
 * The full practice (LinkedIn, campaigns, scripts) is written after Pam's call.
 */

export type AvaCallProtocol = "intake" | "followup";

/** Pam's Advisory Blueprint booking page. Support stays a separate calendar. */
export const PAM_DECISION_CALL_PATH = "/advisory-blueprint";

export function avaCallProtocol(interviewCompletedAt: string | null | undefined): AvaCallProtocol {
  return interviewCompletedAt ? "followup" : "intake";
}

export type PracticeStepId = "ava" | "pam" | "build";

export type PracticeStepState = "done" | "current" | "waiting";

/** What "BCA builds it" means: the pieces the Decision Call unlocks. */
export const BUILD_READY_SECTIONS = [
  "linkedin:rewrite",
  "campaigns:messaging",
  "campaigns:conversation",
  "campaigns:reactivation",
] as const;

export const PRACTICE_STEPS: { id: PracticeStepId; label: string }[] = [
  { id: "ava", label: "Talk to Ava" },
  { id: "pam", label: "Blueprint Call" },
  { id: "build", label: "BCA builds it" },
];

/**
 * Members who joined longer ago than this had their first call before the
 * Blueprint Call was booked here (or never need one), so it counts as done:
 * nobody from before then is sent to book it (5 Nov).
 */
export const BLUEPRINT_CALL_NEW_MEMBER_DAYS = 30;

/** The first unfinished step is the current one. A tick means that step is finished. */
export function practiceStepStates(input: {
  interviewCompletedAt: string | null | undefined;
  /** Old coaches only: a Decision Record locked on the call. */
  decisionLockedAt?: string | null | undefined;
  /** When the booked Blueprint Call starts. Once that time has passed, the call is done. */
  callAt?: string | null | undefined;
  /** When the coach joined. Joined more than BLUEPRINT_CALL_NEW_MEMBER_DAYS ago: the call counts as done. */
  joinedAt?: string | null | undefined;
  builtSections: Record<string, unknown> | null | undefined;
  now?: number;
}): Record<PracticeStepId, PracticeStepState> {
  const built = input.builtSections ?? {};
  const now = input.now ?? Date.now();
  const callAt = input.callAt ? Date.parse(input.callAt) : NaN;
  const joinedAt = input.joinedAt ? Date.parse(input.joinedAt) : NaN;
  const longStanding = joinedAt < now - BLUEPRINT_CALL_NEW_MEMBER_DAYS * 86_400_000;
  const done: Record<PracticeStepId, boolean> = {
    ava: Boolean(input.interviewCompletedAt),
    pam: Boolean(input.decisionLockedAt) || callAt < now || longStanding,
    build: BUILD_READY_SECTIONS.every((key) => Boolean(built[key])),
  };
  const firstOpen = PRACTICE_STEPS.find((step) => !done[step.id])?.id;
  return {
    ava: done.ava ? "done" : "current",
    pam: done.pam ? "done" : firstOpen === "pam" ? "current" : "waiting",
    build: done.build ? "done" : firstOpen === "build" ? "current" : "waiting",
  };
}

export function avaCallIntro(protocol: AvaCallProtocol): { title: string; detail: string } {
  if (protocol === "intake") {
    return {
      title: "Your first call with Ava",
      detail:
        "She asks for the facts only you know, out loud. You can type if you would rather.",
    };
  }
  return {
    title: "Talk with Ava",
    detail:
      "The first call is done. She only asks what is still open. BCA drafts the markets and the campaign angle, and the Blueprint Call locks them.",
  };
}
