import {
  SUPPORT_AUTHOR_SELECT,
  normalizeSupportAuthor,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";
import { extractMentionUserIds } from "@/lib/communityMentions";
import { supabaseClient } from "@/lib/supabaseClient";

export const SUPPORT_INTERNAL_NOTE_BODY_MAX = 10_000;

export type SupportInternalNote = {
  id: string;
  created_at: string;
  edited_at: string | null;
  report_id: string;
  created_by: string;
  body: string;
  mentioned_user_ids: string[];
  author: SupportTicketAuthor | null;
};

const NOTE_SELECT = `
  id,
  created_at,
  edited_at,
  report_id,
  created_by,
  body,
  mentioned_user_ids,
  author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})
`;

type NoteRow = {
  id: string;
  created_at: string;
  edited_at?: string | null;
  report_id: string;
  created_by: string;
  body: string;
  mentioned_user_ids?: string[] | null;
  author?: SupportTicketAuthor | SupportTicketAuthor[] | null;
};

export function mapSupportInternalNote(row: NoteRow): SupportInternalNote {
  return {
    id: row.id,
    created_at: row.created_at,
    edited_at: row.edited_at ?? null,
    report_id: row.report_id,
    created_by: row.created_by,
    body: row.body,
    mentioned_user_ids: Array.isArray(row.mentioned_user_ids)
      ? row.mentioned_user_ids
      : [],
    author: normalizeSupportAuthor(row.author),
  };
}

export async function loadSupportInternalNotes(
  reportId: string
): Promise<{ notes: SupportInternalNote[]; error: string | null }> {
  const { data, error } = await supabaseClient
    .from("support_ticket_internal_notes")
    .select(NOTE_SELECT)
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (error) {
    return { notes: [], error: error.message };
  }

  return {
    notes: (data ?? []).map((row) => mapSupportInternalNote(row as NoteRow)),
    error: null,
  };
}

export async function insertSupportInternalNote(input: {
  reportId: string;
  createdBy: string;
  body: string;
}): Promise<{ note: SupportInternalNote | null; error: string | null }> {
  const body = input.body.trim();
  if (!body) {
    return { note: null, error: "Note cannot be empty." };
  }
  if (body.length > SUPPORT_INTERNAL_NOTE_BODY_MAX) {
    return {
      note: null,
      error: `Note must be ${SUPPORT_INTERNAL_NOTE_BODY_MAX.toLocaleString()} characters or fewer.`,
    };
  }

  const mentioned_user_ids = extractMentionUserIds(body);

  const { data, error } = await supabaseClient
    .from("support_ticket_internal_notes")
    .insert({
      report_id: input.reportId,
      created_by: input.createdBy,
      body,
      mentioned_user_ids,
    })
    .select(NOTE_SELECT)
    .single();

  if (error) {
    return { note: null, error: error.message };
  }

  return { note: mapSupportInternalNote(data as NoteRow), error: null };
}

export async function updateSupportInternalNote(input: {
  noteId: string;
  reportId: string;
  body: string;
}): Promise<{ note: SupportInternalNote | null; error: string | null }> {
  const body = input.body.trim();
  if (!body) {
    return { note: null, error: "Note cannot be empty." };
  }
  if (body.length > SUPPORT_INTERNAL_NOTE_BODY_MAX) {
    return {
      note: null,
      error: `Note must be ${SUPPORT_INTERNAL_NOTE_BODY_MAX.toLocaleString()} characters or fewer.`,
    };
  }

  const mentioned_user_ids = extractMentionUserIds(body);

  const { data, error } = await supabaseClient
    .from("support_ticket_internal_notes")
    .update({ body, mentioned_user_ids })
    .eq("id", input.noteId)
    .eq("report_id", input.reportId)
    .select(NOTE_SELECT)
    .single();

  if (error) {
    return { note: null, error: error.message };
  }

  return { note: mapSupportInternalNote(data as NoteRow), error: null };
}

export async function deleteSupportInternalNote(input: {
  noteId: string;
  reportId: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabaseClient
    .from("support_ticket_internal_notes")
    .delete()
    .eq("id", input.noteId)
    .eq("report_id", input.reportId);

  return { error: error?.message ?? null };
}
