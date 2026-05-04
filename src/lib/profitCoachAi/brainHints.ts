import { getOutputById } from "./registry";
import type { AiContextKey, CoachAiContext } from "./types";

export function isContextKeyEmpty(
  ctx: CoachAiContext | null | undefined,
  key: AiContextKey
): boolean {
  if (!ctx) return true;
  if (key === "client_results") {
    const arr = ctx.client_results ?? [];
    return arr.length === 0 || arr.every((r) => !(r.story ?? "").trim());
  }
  const v = ctx[key];
  return typeof v !== "string" || v.trim().length < 3;
}

/** Short banner copy when hinted brain fields are missing (UI nudge). */
export function getBrainGapBannerText(
  outputId: string,
  brain: CoachAiContext | null | undefined
): string | null {
  const out = getOutputById(outputId);
  if (!out?.contextHints?.keys.length) return null;
  const anyEmpty = out.contextHints.keys.some((k) =>
    isContextKeyEmpty(brain, k)
  );
  if (!anyEmpty) return null;
  return out.contextHints.encouragement;
}
