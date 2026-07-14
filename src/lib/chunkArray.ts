/** Split an array into fixed-size batches (last batch may be smaller). */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error("chunk size must be positive");
  }
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Safe batch size for PostgREST `.in()` filters.
 * Large ID lists make GET URLs too long and fail silently in enrichers.
 */
export const SUPABASE_IN_FILTER_CHUNK = 100;
