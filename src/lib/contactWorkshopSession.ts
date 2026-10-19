import {
  isMissingColumnError,
  type SupabaseLikeError,
} from "@/lib/contactsSchemaSafeSelect";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
      const row = result.data as unknown as Record<string, unknown>;
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
