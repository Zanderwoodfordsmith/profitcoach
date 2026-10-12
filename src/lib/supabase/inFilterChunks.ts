/**
 * PostgREST sends `.in()` filters on the request URL. Node refuses the
 * response once that URL passes ~16KB (`TypeError: fetch failed` /
 * `UND_ERR_HEADERS_OVERFLOW`). 250 LinkedIn profile URLs already cross it.
 */

export const IN_FILTER_MAX_COUNT = 100;
/** Quotes, commas, and the value itself. Kept well under the 16KB header cap. */
export const IN_FILTER_MAX_CHARS = 7000;

export function chunkForInFilter(values: readonly string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const value of values) {
    if (!value) continue;
    const extra = value.length + 3;
    const overflow =
      current.length >= IN_FILTER_MAX_COUNT ||
      (current.length > 0 && chars + extra > IN_FILTER_MAX_CHARS);
    if (overflow) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(value);
    chars += extra;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export async function selectRowsWhereIn<T>(
  values: readonly string[],
  query: (chunk: string[]) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  const rows: T[] = [];
  for (const chunk of chunkForInFilter(unique)) {
    const { data, error } = await query(chunk);
    if (error) throw new Error(error.message);
    if (data?.length) rows.push(...data);
  }
  return rows;
}
