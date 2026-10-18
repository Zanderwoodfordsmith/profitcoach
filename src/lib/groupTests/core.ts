/**
 * BCA group tests: pure helpers (no database).
 *
 * A test has exactly 2 arms, A and B (versions of one step). Two arms also
 * need half the people of three to reach a result. Arm bodies may contain:
 * - [[slot]]  filled once by each coach when they join (e.g. [[tribe]])
 * - {{merge}} normal merge fields, filled per prospect at send time
 *   (including {{profile_hook}}, a line written from their LinkedIn profile)
 * Everything else is fixed so results are comparable across coaches.
 */

export type GroupTestArm = { key: string; label: string; body: string };
export type GroupTestSlot = { key: string; label: string; hint?: string; max?: number };

export type GroupTest = {
  id: string;
  name: string;
  hypothesis: string | null;
  step_type: "invite" | "message";
  arms: GroupTestArm[];
  slots: GroupTestSlot[];
  status: "draft" | "live" | "ended";
  target_per_arm: number;
};

export const SLOT_RE = /\[\[\s*([a-z0-9_]+)\s*\]\]/gi;

export function slotsUsed(arms: GroupTestArm[]): string[] {
  const keys = new Set<string>();
  for (const arm of arms) for (const m of arm.body.matchAll(SLOT_RE)) keys.add((m[1] ?? "").toLowerCase());
  return [...keys];
}

export function validateTest(input: { name: string; arms: GroupTestArm[]; slots: GroupTestSlot[]; step_type: string }): string | null {
  if (!input.name.trim()) return "Give the test a name.";
  if (input.step_type !== "invite" && input.step_type !== "message") return "Pick the step being tested.";
  if (input.arms.length !== 2) return "A test compares 2 versions, A and B.";
  const keys = input.arms.map((a) => a.key).sort().join("");
  if (keys !== "AB") return "Call the versions A and B.";
  if (input.arms.some((a) => !a.body.trim())) return "Every version needs wording.";
  const declared = new Set(input.slots.map((s) => s.key.toLowerCase()));
  const missing = slotsUsed(input.arms).filter((k) => !declared.has(k));
  if (missing.length) return `Add a fill-in for ${missing.map((k) => `[[${k}]]`).join(", ")}.`;
  return null;
}

export function validateFills(slots: GroupTestSlot[], fills: Record<string, unknown>): { fills: Record<string, string>; error: string | null } {
  const out: Record<string, string> = {};
  for (const slot of slots) {
    const raw = typeof fills[slot.key] === "string" ? (fills[slot.key] as string).trim().replace(/\s+/g, " ") : "";
    if (!raw) return { fills: out, error: `Fill in "${slot.label}".` };
    const max = slot.max ?? 120;
    if (raw.length > max) return { fills: out, error: `"${slot.label}" can be up to ${max} characters.` };
    if (/\[\[|\]\]|\{\{|\}\}/.test(raw)) return { fills: out, error: `"${slot.label}" can't contain brackets.` };
    out[slot.key] = raw;
  }
  return { fills: out, error: null };
}

export function fillArm(body: string, fills: Record<string, string>): string {
  return body.replace(SLOT_RE, (_, key: string) => fills[key.toLowerCase()] ?? fills[key] ?? "");
}

export type ArmStats = { key: string; label: string; people: number; accepted: number; replied: number; interested: number; coaches: number };

/** Two-proportion z-test p-value (two-sided). */
export function pValue(x1: number, n1: number, x2: number, n2: number): number | null {
  if (!n1 || !n2) return null;
  const p = (x1 + x2) / (n1 + n2);
  if (p <= 0 || p >= 1) return null;
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  const z = Math.abs(x1 / n1 - x2 / n2) / se;
  // erfc approximation (Abramowitz-Stegun 7.1.26)
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return Math.min(1, y * Math.exp(-((z / Math.SQRT2) ** 2)));
}

/** Plain-English read of a test so far. */
export function verdict(arms: ArmStats[], metric: "accepted" | "replied" | "interested", target: number): string {
  if (arms.length < 2) return "Not enough versions.";
  const sorted = [...arms].sort((a, b) => b[metric] / Math.max(1, b.people) - a[metric] / Math.max(1, a.people));
  const [best, next] = sorted;
  if (!best || !next) return "Not enough data.";
  const minPeople = Math.min(...arms.map((a) => a.people));
  const p = pValue(best[metric], best.people, next[metric], next.people);
  const rate = (a: ArmStats) => `${((100 * a[metric]) / Math.max(1, a.people)).toFixed(1)}%`;
  if (p !== null && p < 0.05 && minPeople >= 200) {
    return `${best.label} is winning on ${metric} (${rate(best)} vs ${rate(next)}), and that's unlikely to be luck.`;
  }
  if (minPeople < target) {
    return `Too early: ${minPeople} of ${target} people in the smallest version. ${best.label} leads on ${metric} (${rate(best)} vs ${rate(next)}) so far.`;
  }
  return `No clear winner yet on ${metric} (${rate(best)} vs ${rate(next)}).`;
}
