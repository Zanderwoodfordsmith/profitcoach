import type { CareerResult } from "./types";

/** A result for a client: current, past, or from before we asked which. */
export function isClientResult(r: CareerResult): boolean {
  return r.proof_type === "current_client" || r.proof_type === "past_client" || r.proof_type === "client";
}

/** "Current client", "Past client", "Client", "Own business", "Career", or "" when not said. */
export function resultKind(r: CareerResult): string {
  if (r.proof_type === "current_client") return "Current client";
  if (r.proof_type === "past_client") return "Past client";
  if (r.proof_type === "client") return "Client";
  if (r.proof_type === "own_business") return "Own business";
  if (r.proof_type === "career") return "Career";
  return "";
}

/** "£300k to £600k", or the result in words when there is no before and after. */
export function resultChange(r: CareerResult): string {
  const from = r.metric_from.trim();
  const to = r.metric_to.trim();
  if (from && to) return `${from} to ${to}`;
  return r.summary?.trim() || to || from;
}

/** "as Finance Director at Harlow & Pike", or "for Sarah Jones at Jones Build". */
export function resultWhere(r: CareerResult): string {
  if (isClientResult(r)) {
    const who = [r.client_name?.trim(), r.company.trim()].filter(Boolean).join(" at ");
    return who ? `for ${who}` : "";
  }
  return [r.role.trim() && `as ${r.role.trim()}`, r.company.trim() && `at ${r.company.trim()}`].filter(Boolean).join(" ");
}

/** One plain line: what changed, how long it took, and where. */
export function resultLine(r: CareerResult): string {
  return [resultChange(r), r.timeframe.trim() && `in ${r.timeframe.trim()}`, resultWhere(r)].filter(Boolean).join(" ");
}

/** Counts toward "has proof": a result with numbers and a timeline, or any client result. */
export function isUsableResult(r: CareerResult): boolean {
  if (r.precise && (r.metric_from.trim() || r.metric_to.trim()) && r.timeframe.trim()) return true;
  return r.proof_type !== "career" && r.proof_type !== "own_business" && Boolean(resultChange(r) || r.mechanism.trim() || r.quote?.trim());
}
