import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export const CONTACTS_SESSION_NOTES_MIGRATION_HINT =
  "Apply Supabase migrations for contacts workshop session fields (session_answers, pillar_session_notes, playbook_session_notes), then retry.";

type WorkshopSessionContact = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
  coach_id: string | null;
  session_answers: unknown;
  pillar_session_notes: unknown;
  playbook_session_notes: unknown;
  session_insights: unknown;
  session_insights_generated_at: string | null;
};

/**
 * Loads a contact for the BOSS workshop session API, falling back when note
 * columns are missing (migration not applied yet).
 */
export async function loadContactForWorkshopSession(
  contactId: string
): Promise<{ contact: WorkshopSessionContact | null; error: SupabaseLikeError }> {
  const withInsights =
    "id, full_name, email, business_name, coach_id, session_answers, pillar_session_notes, playbook_session_notes, session_insights, session_insights_generated_at";
  const withNotes =
    "id, full_name, email, business_name, coach_id, session_answers, pillar_session_notes, playbook_session_notes";
  const base = "id, full_name, email, business_name, coach_id";

  for (const columns of [withInsights, withNotes, base]) {
    const result = await supabaseAdmin
      .from("contacts")
      .select(columns)
      .eq("id", contactId)
      .maybeSingle();

    if (!result.error && result.data) {
      const row = result.data as Record<string, unknown>;
      return {
        contact: {
          id: row.id as string,
          full_name: row.full_name as string,
          email: (row.email as string | null) ?? null,
          business_name: (row.business_name as string | null) ?? null,
          coach_id: (row.coach_id as string | null) ?? null,
          session_answers: row.session_answers ?? {},
          pillar_session_notes: row.pillar_session_notes ?? {},
          playbook_session_notes: row.playbook_session_notes ?? {},
          session_insights: row.session_insights ?? null,
          session_insights_generated_at:
            (row.session_insights_generated_at as string | null) ?? null,
        },
        error: null,
      };
    }

    if (result.error && !isMissingColumnError(result.error)) {
      return { contact: null, error: result.error };
    }
  }

  return { contact: null, error: null };
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
    const next = { ...(row as Record<string, unknown>) };
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
