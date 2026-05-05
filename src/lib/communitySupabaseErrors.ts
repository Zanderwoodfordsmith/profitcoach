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

/** Missing community feed counter columns (migration not applied). */
export function isMissingFeedCounterColumnError(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  const missingKnownColumn =
    msg.includes("feed_comment_count") ||
    msg.includes("feed_like_count") ||
    (msg.includes("last_comment_at") &&
      msg.includes("community_posts") &&
      msg.includes("column"));
  if (!missingKnownColumn) return false;
  return err.code === "42703" || msg.includes("does not exist");
}
