type SupabaseLikeError = {
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

/**
 * Tries selecting contacts with `phone`; falls back without it when the column
 * is missing (migration not applied yet).
 */
export async function selectContactsWithOptionalPhone<
  T extends Record<string, unknown>,
>(
  fetch: (columns: string) => PromiseLike<SupabaseSelectResult>,
  baseColumns: string
): Promise<{ data: T[]; error: SupabaseLikeError }> {
  const withPhone = `${baseColumns}, phone`;
  const first = await fetch(withPhone);
  if (!first.error) {
    return { data: (first.data ?? []) as unknown as T[], error: null };
  }
  if (!isMissingColumnError(first.error)) {
    return { data: [], error: first.error };
  }

  const fallback = await fetch(baseColumns);
  if (fallback.error) {
    return { data: [], error: fallback.error };
  }

  return {
    data: (fallback.data ?? []).map((row) => ({
      ...(row as Record<string, unknown>),
      phone: null,
    })) as unknown as T[],
    error: null,
  };
}
