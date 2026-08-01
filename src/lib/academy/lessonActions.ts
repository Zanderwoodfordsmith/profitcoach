/** Client-safe helpers for academy lesson recommended actions. */

export type AcademyRecommendedAction = {
  id: string;
  text: string;
};

export function parseRecommendedActions(raw: unknown): AcademyRecommendedAction[] {
  if (!Array.isArray(raw)) return [];
  const out: AcademyRecommendedAction[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const text = item.trim();
      if (!text) continue;
      out.push({ id: `legacy-${out.length}`, text });
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
    out.push({ id, text });
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
    };
  });
}

export function recommendedActionsToLines(
  actions: AcademyRecommendedAction[]
): string {
  return actions.map((a) => a.text).join("\n");
}
