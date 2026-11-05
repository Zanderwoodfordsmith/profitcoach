import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { setChatPage, suggestPagesForChat } from "@/lib/support/chatPageSuggest";

/**
 * What a Support chat is about (5 Nov): BCA links it to a page in the app so
 * the coach gets an "Open … page" button beside the chat. GET gives the AI's
 * suggestions; POST saves BCA's pick (or clears it).
 */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error !== null) return NextResponse.json({ error: check.error }, { status: 401 });
  const reportId = new URL(request.url).searchParams.get("report_id")?.trim() ?? "";
  if (!reportId) return NextResponse.json({ error: "Which chat?" }, { status: 400 });
  const suggestions = await suggestPagesForChat(reportId);
  return NextResponse.json({ suggestions });
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (check.error !== null) return NextResponse.json({ error: check.error }, { status: 401 });
  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const reportId = typeof rec.report_id === "string" ? rec.report_id.trim() : "";
  const path = typeof rec.path === "string" && rec.path.trim() ? rec.path.trim() : null;
  if (!reportId) return NextResponse.json({ error: "Which chat?" }, { status: 400 });
  const ok = await setChatPage(reportId, path);
  if (!ok) return NextResponse.json({ error: "Could not link that page." }, { status: 400 });
  return NextResponse.json({ path });
}
