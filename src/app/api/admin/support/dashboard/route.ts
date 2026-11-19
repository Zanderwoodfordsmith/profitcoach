import { NextResponse, after } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import type { DashTicket } from "@/lib/support/dashboardStats";
import { tagUntaggedSupportTickets } from "@/lib/support/ticketTopics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Support dashboard (job 237): every ticket in the inbox, cut down to what the
 * numbers need, each marked with whether a coach started it. The page works
 * out the periods itself.
 * Tickets with no topic yet are sorted after the response goes out.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });

  const [{ data: admins }, { data: tickets, error }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id").eq("role", "admin"),
    supabaseAdmin
      .from("community_feedback_reports")
      .select(
        "id, ticket_number, title, created_at, resolved_at, status, type, source, ai_topic, created_by, created_by_admin, submitter_name, reopened_at, topic, author:profiles!created_by (full_name)"
      )
      // Launch threads are BCA's own job chats, not coach questions.
      .is("topic", null)
      .order("created_at", { ascending: true })
      .limit(10000),
  ]);
  if (error) return NextResponse.json({ error: "Couldn't load tickets." }, { status: 500 });

  const adminIds = new Set((admins ?? []).map((a) => a.id as string));
  const all = tickets ?? [];
  const ids = all.map((t) => t.id as string);

  const replies: { report_id: string; created_at: string; created_by: string | null; as_ava: boolean | null }[] = [];
  const votes: { report_id: string; helpful: boolean }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [r, v] = await Promise.all([
      supabaseAdmin
        .from("community_feedback_replies")
        .select("report_id, created_at, created_by, as_ava")
        .in("report_id", chunk)
        .order("created_at", { ascending: true })
        .limit(10000),
      supabaseAdmin.from("support_ticket_feedback").select("report_id, helpful").in("report_id", chunk),
    ]);
    replies.push(...((r.data ?? []) as typeof replies));
    votes.push(...((v.data ?? []) as typeof votes));
  }

  const firstReply = new Map<string, string>();
  const bcaReplies = new Map<string, number>();
  for (const r of replies) {
    const fromBca = Boolean(r.as_ava) || (r.created_by !== null && adminIds.has(r.created_by));
    if (!fromBca) continue;
    if (!firstReply.has(r.report_id)) firstReply.set(r.report_id, r.created_at);
    bcaReplies.set(r.report_id, (bcaReplies.get(r.report_id) ?? 0) + 1);
  }
  const helpful = new Map(votes.map((v) => [v.report_id, v.helpful]));

  const rows: DashTicket[] = all.map((t) => {
    const author = (Array.isArray(t.author) ? t.author[0] : t.author) as { full_name?: string | null } | null;
    return {
      id: t.id,
      number: t.ticket_number ?? null,
      title: (t.title ?? "").slice(0, 140),
      createdAt: t.created_at,
      resolvedAt: t.resolved_at ?? null,
      status: t.status,
      type: t.type,
      source: t.source,
      topic: t.ai_topic ?? null,
      coachId: t.created_by ?? (t.submitter_name ? `name:${t.submitter_name}` : null),
      coachName: author?.full_name?.trim() || t.submitter_name?.trim() || "Unknown",
      firstReplyAt: firstReply.get(t.id) ?? null,
      bcaReplies: bcaReplies.get(t.id) ?? 0,
      reopened: Boolean(t.reopened_at),
      helpful: helpful.has(t.id) ? helpful.get(t.id)! : null,
      // Not BCA's own notes and ideas, nor chats BCA opened (on WhatsApp or for a coach).
      coachStarted: !t.created_by_admin && !(t.created_by && adminIds.has(t.created_by)),
    };
  });

  if (rows.some((r) => !r.topic)) {
    after(async () => {
      await tagUntaggedSupportTickets(20).catch(() => 0);
    });
  }

  return NextResponse.json({ tickets: rows, now: new Date().toISOString() });
}
