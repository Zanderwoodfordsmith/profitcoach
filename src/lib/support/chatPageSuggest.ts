import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { aiSuggestChatPages, chatForAi } from "./chatPageAi";
import { chatPageFor } from "./chatPages";

/** The AI's pages for one Support chat, read from the database. Empty if none fit. */
export async function suggestPagesForChat(reportId: string): Promise<string[]> {
  const { data: report } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id, title, details")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return [];
  const { data: replies } = await supabaseAdmin
    .from("community_feedback_replies")
    .select("body, created_at, author:profiles!created_by (role)")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  const opening = [report.title, report.details].filter(Boolean).join("\n");
  const lines = (replies ?? []).map((r) => {
    const author = (Array.isArray(r.author) ? r.author[0] : r.author) as { role?: string | null } | null;
    return { body: r.body ?? "", fromBca: author?.role === "admin" };
  });
  return aiSuggestChatPages(chatForAi(opening, lines));
}

/** Saves what a chat is about. Only pages from the list, or null to clear it. */
export async function setChatPage(reportId: string, path: string | null): Promise<boolean> {
  if (path !== null && !chatPageFor(path)) return false;
  const { error } = await supabaseAdmin.from("community_feedback_reports").update({ context_path: path }).eq("id", reportId);
  return !error;
}
