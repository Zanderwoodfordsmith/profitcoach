/** Client-safe helpers for academy lesson recommended actions. */

/** Coach ticks it off themselves. */
export type AcademyActionCompletion = "manual" | "tracked";

/**
 * System checks that prove a tracked action is done.
 * Add new keys as we wire up more product signals (tools, OS, etc.).
 */
export const ACADEMY_VERIFY_RULE_KEYS = [
  "community_intro_posted",
  "community_reply_with_mention",
  "community_map_location_set",
  "start_here_lessons_complete",
] as const;

export type AcademyVerifyRuleKey = (typeof ACADEMY_VERIFY_RULE_KEYS)[number];

export const ACADEMY_VERIFY_RULE_LABELS: Record<AcademyVerifyRuleKey, string> = {
  community_intro_posted: "Posted in Intros",
  community_reply_with_mention: "Replied and @mentioned someone",
  community_map_location_set: "Added location on Community Map",
  start_here_lessons_complete: "All Start Here lessons completed",
};

export type AcademyRecommendedAction = {
  id: string;
  text: string;
  /**
   * `manual` (default): coach can tick the checkbox.
   * `tracked`: only completes when `verifyRule` passes — no self-tick.
   */
  completion?: AcademyActionCompletion;
  /** Required when completion is `tracked`. */
  verifyRule?: AcademyVerifyRuleKey | null;
};

export function isTrackedRecommendedAction(
  action: AcademyRecommendedAction
): boolean {
  return action.completion === "tracked" && Boolean(action.verifyRule);
}

export function parseVerifyRule(value: unknown): AcademyVerifyRuleKey | null {
  if (typeof value !== "string") return null;
  return ACADEMY_VERIFY_RULE_KEYS.includes(value as AcademyVerifyRuleKey)
    ? (value as AcademyVerifyRuleKey)
    : null;
}

export function parseCompletion(value: unknown): AcademyActionCompletion {
  return value === "tracked" ? "tracked" : "manual";
}

export function parseRecommendedActions(raw: unknown): AcademyRecommendedAction[] {
  if (!Array.isArray(raw)) return [];
  const out: AcademyRecommendedAction[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const text = item.trim();
      if (!text) continue;
      out.push({ id: `legacy-${out.length}`, text, completion: "manual" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const text =
      typeof (item as { text?: unknown }).text === "string"
        ? (item as { text: string }).text.trim()
        : "";
    if (!text) continue;
    const idRaw = (item as { id?: unknown }).id;
    const id =
      typeof idRaw === "string" && idRaw.trim()
        ? idRaw.trim()
        : `legacy-${out.length}`;
    const verifyRule = parseVerifyRule(
      (item as { verifyRule?: unknown }).verifyRule
    );
    const completionRaw = parseCompletion(
      (item as { completion?: unknown }).completion
    );
    const completion: AcademyActionCompletion =
      completionRaw === "tracked" && verifyRule ? "tracked" : "manual";
    out.push({
      id,
      text,
      completion,
      verifyRule: completion === "tracked" ? verifyRule : null,
    });
  }
  return out;
}

/** One action per non-empty line. Preserves ids when text still matches previous. */
export function recommendedActionsFromLines(
  linesText: string,
  previous: AcademyRecommendedAction[] = []
): AcademyRecommendedAction[] {
  const lines = linesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const unused = [...previous];
  return lines.map((text) => {
    const matchIndex = unused.findIndex((item) => item.text === text);
    if (matchIndex >= 0) {
      const [match] = unused.splice(matchIndex, 1);
      return match;
    }
    return {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text,
      completion: "manual" as const,
    };
  });
}

export function recommendedActionsToLines(
  actions: AcademyRecommendedAction[]
): string {
  return actions.map((a) => a.text).join("\n");
}
