/** Modal-only: collapse body when it is very long (either threshold applies). */
export function postBodyNeedsTruncation(body: string): boolean {
  const trimmed = body ?? "";
  if (trimmed.length > 500) return true;
  const logicalLines = trimmed.split(/\r?\n/).length;
  return logicalLines > 9;
}

/**
 * Feed-style preview: short clamp like community PostCard (≈2 lines).
 * Either threshold applies.
 */
export function feedBodyNeedsTruncation(body: string): boolean {
  const trimmed = body ?? "";
  if (trimmed.length > 140) return true;
  const logicalLines = trimmed.split(/\r?\n/).length;
  return logicalLines > 2;
}
