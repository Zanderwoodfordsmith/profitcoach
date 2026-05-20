import { PLAYBOOKS } from "@/lib/bossData";

/** Scorecard question id → BOSS grid area index (0–9) */
const SCORECARD_Q_TO_AREA: Record<string, number> = {
  q1: 0,
  q2: 1,
  q3: 2,
  q4: 3,
  q5: 4,
  q6: 5,
  q7: 6,
  q8: 7,
  q9: 8,
  q10: 9,
};

/** All five level playbooks for a scorecard focus area */
export function getPlaybooksForScorecardQuestion(questionId: string): string[] {
  const areaId = SCORECARD_Q_TO_AREA[questionId];
  if (areaId == null) return [];
  return [1, 2, 3, 4, 5]
    .map(
      (level) =>
        PLAYBOOKS.find((p) => p.area === areaId && p.level === level)?.name
    )
    .filter((name): name is string => Boolean(name));
}

/**
 * Split area label for venn curved text: use & instead of "and",
 * placing & on the line with the shorter word.
 */
export function splitAreaTitleForDiagram(title: string): {
  line1: string;
  line2: string;
} {
  const normalized = title.replace(/\s+and\s+/gi, " & ");
  const ampIdx = normalized.indexOf(" & ");
  if (ampIdx === -1) {
    const words = normalized.split(/\s+/);
    if (words.length <= 2) return { line1: normalized, line2: "" };
    const mid = Math.ceil(words.length / 2);
    return {
      line1: words.slice(0, mid).join(" "),
      line2: words.slice(mid).join(" "),
    };
  }
  const part1 = normalized.slice(0, ampIdx).trim();
  const part2 = normalized.slice(ampIdx + 3).trim();
  if (part1.length <= part2.length) {
    return { line1: `${part1} &`, line2: part2 };
  }
  return { line1: part1, line2: `& ${part2}` };
}

export function firstNameFromFull(fullName: string | null | undefined): string | null {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0] ?? null;
}
