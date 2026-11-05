import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { BLUEPRINT_PAGES } from "./blueprint";
import { pageStatus, type PageStatusId } from "./pageStatus";
import type { PracticeKnowledgeRow } from "./types";

/** A page moving from one status to another, for the quiet line in its chat (5 Nov). */
export type PageMove = {
  id: string;
  page_slug: string;
  from: PageStatusId;
  to: PageStatusId;
  at: string;
};

const STATUSES = new Set<string>(["needs_you", "bca", "in_progress", "review", "done"]);

/**
 * After a save: note each page whose status changed. Never throws, so a
 * failure here can't stop the save itself.
 */
export async function recordPageMoves(coachId: string, before: PracticeKnowledgeRow, after: PracticeKnowledgeRow): Promise<void> {
  try {
    const rows = BLUEPRINT_PAGES.flatMap((page) => {
      const from = pageStatus(page, before);
      const to = pageStatus(page, after);
      return from && to && from !== to ? [{ coach_id: coachId, page_slug: page.slug, from_status: from, to_status: to }] : [];
    });
    if (!rows.length) return;
    const { error } = await supabaseAdmin.from("practice_page_status_events").insert(rows);
    if (error) console.error("page moves:", error.message);
  } catch (err) {
    console.error("page moves:", err instanceof Error ? err.message : "failed");
  }
}

export async function listPageMoves(coachId: string): Promise<PageMove[]> {
  const { data, error } = await supabaseAdmin
    .from("practice_page_status_events")
    .select("id, page_slug, from_status, to_status, created_at")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => STATUSES.has(r.from_status) && STATUSES.has(r.to_status))
    .map((r) => ({
      id: r.id as string,
      page_slug: r.page_slug as string,
      from: r.from_status as PageStatusId,
      to: r.to_status as PageStatusId,
      at: r.created_at as string,
    }));
}
