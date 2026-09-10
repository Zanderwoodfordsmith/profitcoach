import { supabaseClient } from "@/lib/supabaseClient";

const LOCAL_STORAGE_PREFIX = "support-admin-reply-draft:";

function localStorageKey(reportId: string): string {
  return `${LOCAL_STORAGE_PREFIX}${reportId}`;
}

function readLegacyLocalDraft(reportId: string): string {
  if (typeof window === "undefined" || !reportId) return "";
  try {
    return window.localStorage.getItem(localStorageKey(reportId)) ?? "";
  } catch {
    return "";
  }
}

function clearLegacyLocalDraft(reportId: string): void {
  if (typeof window === "undefined" || !reportId) return;
  try {
    window.localStorage.removeItem(localStorageKey(reportId));
  } catch {
    // ignore
  }
}

/** Load a previously autosaved admin reply draft for a ticket (this admin). */
export async function loadAdminReplyDraft(reportId: string): Promise<string> {
  if (!reportId) return "";

  const { data, error } = await supabaseClient
    .from("support_admin_reply_drafts")
    .select("body")
    .eq("report_id", reportId)
    .maybeSingle();

  if (!error && data?.body) {
    clearLegacyLocalDraft(reportId);
    return typeof data.body === "string" ? data.body : "";
  }

  // One-time migrate drafts saved before DB-backed autosave.
  const legacy = readLegacyLocalDraft(reportId);
  if (legacy.trim()) {
    await saveAdminReplyDraft(reportId, legacy);
    clearLegacyLocalDraft(reportId);
    return legacy;
  }

  return "";
}

/**
 * Persist an admin reply draft. Empty / whitespace-only text deletes the row.
 */
export async function saveAdminReplyDraft(
  reportId: string,
  text: string
): Promise<void> {
  if (!reportId) return;

  const trimmed = text.trim();
  if (!trimmed) {
    await clearAdminReplyDraft(reportId);
    return;
  }

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user?.id) return;

  const { error } = await supabaseClient.from("support_admin_reply_drafts").upsert(
    {
      report_id: reportId,
      admin_id: user.id,
      body: text,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "report_id,admin_id" }
  );

  if (error) {
    // Network / RLS — keep in-memory draft for this session.
    return;
  }

  clearLegacyLocalDraft(reportId);
}

/** Remove a stored draft after a successful send (or explicit discard). */
export async function clearAdminReplyDraft(reportId: string): Promise<void> {
  if (!reportId) return;
  clearLegacyLocalDraft(reportId);

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user?.id) return;

  await supabaseClient
    .from("support_admin_reply_drafts")
    .delete()
    .eq("report_id", reportId)
    .eq("admin_id", user.id);
}
