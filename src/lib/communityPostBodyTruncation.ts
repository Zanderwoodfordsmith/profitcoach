/** Modal-only: collapse body when it is very long (either threshold applies). */
export function postBodyNeedsTruncation(body: string): boolean {
  const trimmed = body ?? "";
  if (trimmed.length > 500) return true;
  const logicalLines = trimmed.split(/\r?\n/).length;
  return logicalLines > 9;
}
