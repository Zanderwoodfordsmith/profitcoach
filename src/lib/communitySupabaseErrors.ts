/** Missing table / relation (migration not applied or wrong schema). */
export function isUndefinedRelationError(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("relation") && msg.includes("does not exist");
}
