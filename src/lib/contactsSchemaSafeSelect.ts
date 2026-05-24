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
  "Apply Supabase migrations for contacts session notes (pillar_session_notes and playbook_session_notes), then retry.";

type WorkshopSessionContact = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
  coach_id: string | null;
  pillar_session_notes: unknown;
  playbook_session_notes: unknown;
};

/**
 * Loads a contact for the BOSS workshop session API, falling back when note
 * columns are missing (migration not applied yet).
 */
export async function loadContactForWorkshopSession(
  contactId: string
): Promise<{ contact: WorkshopSessionContact | null; error: SupabaseLikeError }> {
  const withNotes =
    "id, full_name, email, business_name, coach_id, pillar_session_notes, playbook_session_notes";
  const base = "id, full_name, email, business_name, coach_id";

  const first = await supabaseAdmin
    .from("contacts")
    .select(withNotes)
    .eq("id", contactId)
    .maybeSingle();

  if (!first.error && first.data) {
    return { contact: first.data as WorkshopSessionContact, error: null };
  }

  if (first.error && !isMissingColumnError(first.error)) {
    return { contact: null, error: first.error };
  }

  const fallback = await supabaseAdmin
    .from("contacts")
    .select(base)
    .eq("id", contactId)
    .maybeSingle();

  if (fallback.error) {
    return { contact: null, error: fallback.error };
  }

  if (!fallback.data) {
    return { contact: null, error: null };
  }

  return {
    contact: {
      ...(fallback.data as Omit<
        WorkshopSessionContact,
        "pillar_session_notes" | "playbook_session_notes"
      >),
      pillar_session_notes: {},
      playbook_session_notes: {},
    },
    error: null,
  };
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
