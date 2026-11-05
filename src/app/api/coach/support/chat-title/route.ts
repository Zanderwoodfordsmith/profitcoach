import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { CHAT_TITLE_MAX, topicFrom } from "@/lib/support/chatTitle";
import { aiChatTitle } from "@/lib/support/chatTitleAi";
import { setChatPage, suggestPagesForChat } from "@/lib/support/chatPageSuggest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Name a new Inbox chat with BCA from its first message (5 Nov). Runs just
 * after the chat starts; until then it shows its opening words. Leaves the
 * name alone if the coach has already renamed it. Also links the chat to the
 * page it's about, when the AI sees one clearly (BCA can change it).
 */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request);
  if (check.error !== null) {
    return NextResponse.json({ error: check.error }, { status: 401 });
  }
  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const reportId = typeof rec.report_id === "string" ? rec.report_id.trim() : "";
  if (!reportId) return NextResponse.json({ error: "Which chat?" }, { status: 400 });

  const { data: report } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id, title, details, context_path")
    .eq("id", reportId)
    .eq("created_by", check.userId)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: "Chat not found." }, { status: 404 });

  const page = report.context_path
    ? Promise.resolve(report.context_path as string)
    : suggestPagesForChat(reportId).then(async ([best]) => (best && (await setChatPage(reportId, best)) ? best : null));
  const title = await nameIt(reportId, report.title ?? "", report.details ?? "");
  return NextResponse.json({ title, context_path: await page });
}

/** The AI's short name, if it still has its first name; otherwise the name it has. */
async function nameIt(reportId: string, current: string, details: string): Promise<string> {
  const report = { title: current, details };

  const first = topicFrom(report.details);
  if (report.title !== first) return report.title;

  const title = await aiChatTitle(report.details);
  if (!title) return report.title;

  // Only if it still has its first name: a rename in the meantime wins.
  const { data: updated } = await supabaseAdmin
    .from("community_feedback_reports")
    .update({ title })
    .eq("id", reportId)
    .eq("title", first)
    .select("title")
    .maybeSingle();
  return updated?.title ?? report.title;
}

/** The coach renames their chat. Coaches can't write the row themselves, so it goes through here. */
export async function PATCH(request: Request) {
  const check = await requireCoachRequest(request);
  if (check.error !== null) {
    return NextResponse.json({ error: check.error }, { status: 401 });
  }
  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const reportId = typeof rec.report_id === "string" ? rec.report_id.trim() : "";
  const title = typeof rec.title === "string" ? rec.title.trim().slice(0, CHAT_TITLE_MAX) : "";
  if (!reportId || !title) return NextResponse.json({ error: "Give the chat a name." }, { status: 400 });

  const { data: updated, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .update({ title })
    .eq("id", reportId)
    .eq("created_by", check.userId)
    .select("title")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not rename it." }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  return NextResponse.json({ title: updated.title });
}
