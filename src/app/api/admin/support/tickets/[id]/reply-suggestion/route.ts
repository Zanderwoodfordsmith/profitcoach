import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  dismissSupportReplySuggestion,
  ensureSupportReplySuggestion,
  recordSupportReplySent,
} from "@/lib/support/replySuggestion";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The draft waiting on this chat, written now if the cron hasn't reached it. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    return NextResponse.json(await ensureSupportReplySuggestion(id));
  } catch (err) {
    console.error("reply-suggestion GET:", err);
    return NextResponse.json({ error: "Could not load the draft." }, { status: 500 });
  }
}

type Body = {
  action?: "dismiss" | "sent";
  suggestionId?: string;
  replyId?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  const suggestionId = body.suggestionId?.trim();
  if (!suggestionId) {
    return NextResponse.json({ error: "suggestionId is required." }, { status: 400 });
  }

  try {
    if (body.action === "dismiss") {
      await dismissSupportReplySuggestion(id, suggestionId);
    } else if (body.action === "sent" && body.replyId?.trim()) {
      await recordSupportReplySent({
        ticketId: id,
        suggestionId,
        replyId: body.replyId.trim(),
      });
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reply-suggestion POST:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}
