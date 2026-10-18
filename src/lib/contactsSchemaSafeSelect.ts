export type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
} | null;

type SupabaseSelectResult = {
  data: unknown[] | null;
  error: SupabaseLikeError;
};

export function isMissingColumnError(error: SupabaseLikeError): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    (msg.includes("column") && msg.includes("contacts"))
  );
}

export const CONTACTS_SESSION_NOTES_MIGRATION_HINT =
  "Apply Supabase migrations for contacts workshop session fields (session_answers, pillar_session_notes, playbook_session_notes), then retry.";

/**
 * PostgREST / Supabase default max rows per request is 1000. Page through
 * `.range()` until the full result set is loaded.
 */
export async function fetchAllSupabasePages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: SupabaseLikeError }>,
  pageSize = 1000,
  maxRows = 100_000
): Promise<{ data: T[]; error: SupabaseLikeError }> {
  const all: T[] = [];
  let from = 0;

  while (from < maxRows) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const { data, error } = await fetchPage(from, to);
    if (error) return { data: [], error };
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}

/**
 * Tries selecting contacts with `phone`; falls back without it when the column
 * is missing (migration not applied yet).
 */
function withDefaultOptionalContactFields<T extends Record<string, unknown>>(
  rows: unknown[],
  fields: Array<keyof T & string>
): T[] {
  return rows.map((row) => {
    const next = { ...(row as unknown as Record<string, unknown>) };
    for (const field of fields) {
      if (next[field] === undefined) next[field] = null;
    }
    return next as T;
  });
}

export async function selectContactsWithOptionalPhone<
  T extends Record<string, unknown>,
>(
  fetch: (columns: string) => PromiseLike<SupabaseSelectResult>,
  baseColumns: string,
  extraOptionalColumns: string[] = []
): Promise<{ data: T[]; error: SupabaseLikeError }> {
  const optionalColumns = ["phone", ...extraOptionalColumns];
  const withOptional = `${baseColumns}, ${optionalColumns.join(", ")}`;
  const first = await fetch(withOptional);
  if (!first.error) {
    return { data: (first.data ?? []) as unknown as T[], error: null };
  }
  if (!isMissingColumnError(first.error)) {
    return { data: [], error: first.error };
  }

  for (let i = optionalColumns.length - 1; i >= 0; i -= 1) {
    const columns = [baseColumns, ...optionalColumns.slice(0, i)].join(", ");
    const attempt = await fetch(columns);
    if (!attempt.error) {
      const missing = optionalColumns.slice(i);
      return {
        data: withDefaultOptionalContactFields<T>(attempt.data ?? [], missing),
        error: null,
      };
    }
    if (!isMissingColumnError(attempt.error)) {
      return { data: [], error: attempt.error };
    }
  }

  const fallback = await fetch(baseColumns);
  if (fallback.error) {
    return { data: [], error: fallback.error };
  }

  return {
    data: withDefaultOptionalContactFields<T>(fallback.data ?? [], optionalColumns),
    error: null,
  };
}
