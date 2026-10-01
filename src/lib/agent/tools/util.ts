import type { AgentCoach, AgentToolContext, AgentToolInput } from "../types";

/** Small readers for model-supplied tool input. Never trust the shape. */

export function str(input: AgentToolInput, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

export function optStr(input: AgentToolInput, key: string): string | null {
  return str(input, key) || null;
}

export function num(input: AgentToolInput, key: string): number | null {
  const value = input[key];
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function bool(input: AgentToolInput, key: string): boolean | null {
  const value = input[key];
  return typeof value === "boolean" ? value : null;
}

export function strList(input: AgentToolInput, key: string, max = 50): string[] {
  const value = input[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function uuidList(input: AgentToolInput, key: string, max = 2_500): string[] {
  return strList(input, key, max).filter(isUuid);
}

export class AgentToolError extends Error {}

/** The active coach, or a clear error the model can act on. */
export function coachOf(ctx: AgentToolContext): AgentCoach {
  if (!ctx.coach) {
    throw new AgentToolError(
      "No active coach. Ask who this is for, then use find_coach and switch_coach."
    );
  }
  return ctx.coach;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

export function personName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const full = row.full_name?.trim();
  if (full) return full;
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unnamed";
}
