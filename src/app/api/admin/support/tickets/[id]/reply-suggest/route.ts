import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropicModel";
import { consumeReplyCopilotRateLimit } from "@/lib/messaging/replyCopilotRateLimit";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  SUPPORT_COPILOT_MAX_TOKENS,
  sanitizeSupportSuggestion,
} from "@/lib/support/supportCopilot";
import { buildSupportReplyPrompt } from "@/lib/support/replySuggestion";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AuthZ: admin only. Body allowlist is { hint, sendAsId }. Ticket, thread,
 * notes and history are quoted as untrusted data. Suggest-only: the draft
 * goes into the composer and staff send it themselves.
 */
type Body = { hint?: unknown; sendAsId?: unknown };

function textFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id: ticketId } = await context.params;
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticket id." }, { status: 400 });
  }

  if (!consumeReplyCopilotRateLimit(`support:${auth.userId}`)) {
    return NextResponse.json(
      { error: "Too many suggestions. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const hint = typeof body.hint === "string" ? body.hint : "";
  const sendAsId =
    typeof body.sendAsId === "string" && body.sendAsId.trim()
      ? body.sendAsId.trim()
      : auth.userId;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Reply suggestions are not configured." },
      { status: 503 }
    );
  }

  const prompt = await buildSupportReplyPrompt({ ticketId, hint, sendAsId });
  if (!prompt.ok) {
    return NextResponse.json({ error: prompt.error }, { status: prompt.status });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: SUPPORT_COPILOT_MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
    const suggestion = sanitizeSupportSuggestion(textFromMessage(response));
    if (!suggestion) {
      return NextResponse.json(
        { error: "Could not draft a reply. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error(
      "support reply-suggest anthropic:",
      err instanceof Error ? err.message : "failed"
    );
    return NextResponse.json(
      { error: "Could not draft a reply. Try again." },
      { status: 502 }
    );
  }
}
