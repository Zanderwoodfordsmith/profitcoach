import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { loadEnrichedProspectById } from "@/lib/prospects/loadEnrichedProspect";
import { loadThreadMessagePage } from "@/lib/messaging/loadThreadMessages";
import {
  clipReplyCopilotNotes,
  composeReplyCopilotSystem,
  composeReplyCopilotUserMessage,
  isReplyCopilotChannel,
  maxTokensForChannel,
  resolveReplyCopilotModel,
  sanitizeCopilotSuggestion,
  selectCopilotThreadWindow,
  type CopilotThreadMessage,
} from "@/lib/messaging/replyCopilot";
import { consumeReplyCopilotRateLimit } from "@/lib/messaging/replyCopilotRateLimit";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * AuthZ: conversation owner (or admin impersonating that coach). 404 if the
 * conversation is missing/hidden. Body allowlist is { channel } only.
 * Thread + prospect facts are quoted as untrusted data. Suggest-only.
 */
async function loadConversation(id: string, coachId: string) {
  return supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, contact_id, hidden_at")
    .eq("id", id)
    .eq("coach_id", coachId)
    .maybeSingle();
}

function textFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: conversation, error: convErr } = await loadConversation(
    id,
    access.coachId
  );
  if (convErr || !conversation || conversation.hidden_at) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (!consumeReplyCopilotRateLimit(access.coachId)) {
    return NextResponse.json(
      { error: "Too many suggestions. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { channel?: unknown };
  const channelRaw =
    typeof body.channel === "string" ? body.channel.trim().toLowerCase() : "";
  if (channelRaw === "comment") {
    return NextResponse.json(
      { error: "Copilot is not available for internal notes." },
      { status: 400 }
    );
  }
  if (!isReplyCopilotChannel(channelRaw)) {
    return NextResponse.json({ error: "Unsupported channel." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Reply suggestions are not configured." },
      { status: 503 }
    );
  }

  const page = await loadThreadMessagePage({
    conversationId: id,
    limit: 40,
  });
  if (page.error) {
    console.error("reply-suggest thread:", page.error);
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }

  const threadMessages: CopilotThreadMessage[] = page.messages.map((row) => ({
    id: String(row.id ?? ""),
    channel: typeof row.channel === "string" ? row.channel : null,
    direction: typeof row.direction === "string" ? row.direction : null,
    body_text: typeof row.body_text === "string" ? row.body_text : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  }));
  const windowed = selectCopilotThreadWindow(threadMessages, channelRaw);
  if (windowed.length === 0) {
    return NextResponse.json(
      { error: "No recent messages to reply to." },
      { status: 400 }
    );
  }

  const contactId = (conversation.contact_id as string | null) ?? null;
  let prospectFacts: {
    name?: string | null;
    company?: string | null;
    title?: string | null;
    headline?: string | null;
    about?: string | null;
    tags?: string[] | null;
    bossScore?: number | null;
    replyDisposition?: string | null;
  } | null = null;

  if (contactId) {
    const loaded = await loadEnrichedProspectById(contactId, {
      coachId: access.coachId,
    });
    const { data: extra } = await supabaseAdmin
      .from("contacts")
      .select("reply_disposition")
      .eq("id", contactId)
      .eq("coach_id", access.coachId)
      .maybeSingle();
    if (loaded?.prospect) {
      const p = loaded.prospect;
      prospectFacts = {
        name: p.full_name,
        company: p.business_name,
        title: p.job_title,
        headline: p.headline,
        about: p.about,
        tags: p.tags ?? [],
        bossScore: p.boss_score,
        replyDisposition:
          typeof extra?.reply_disposition === "string"
            ? extra.reply_disposition
            : null,
      };
    }
  }

  const [{ data: settings }, notesRes, { data: profile }] =
    await Promise.all([
      supabaseAdmin
        .from("reply_copilot_settings")
        .select("system_prompt, model")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("coaches")
        .select("reply_copilot_notes")
        .eq("id", access.coachId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("full_name, first_name")
        .eq("id", access.coachId)
        .maybeSingle(),
    ]);

  const adminVoice =
    typeof settings?.system_prompt === "string" ? settings.system_prompt : "";
  const coachNotesRaw =
    notesRes.error?.code === "42703" || notesRes.error?.code === "PGRST204"
      ? ""
      : typeof notesRes.data?.reply_copilot_notes === "string"
        ? notesRes.data.reply_copilot_notes
        : "";
  const coachNotes = clipReplyCopilotNotes(coachNotesRaw);
  const coachName =
    (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
    (typeof profile?.first_name === "string" && profile.first_name.trim()) ||
    null;

  const system = composeReplyCopilotSystem({
    adminVoice,
    coachNotes: coachNotes || null,
  });
  const user = composeReplyCopilotUserMessage({
    channel: channelRaw,
    coachName,
    messages: windowed,
    prospect: prospectFacts,
  });

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: resolveReplyCopilotModel(
        typeof settings?.model === "string" ? settings.model : null
      ),
      max_tokens: maxTokensForChannel(channelRaw),
      system,
      messages: [{ role: "user", content: user }],
    });
    const suggestion = sanitizeCopilotSuggestion(textFromMessage(response));
    if (!suggestion) {
      return NextResponse.json(
        { error: "Could not draft a reply. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error(
      "reply-suggest anthropic:",
      err instanceof Error ? err.message : "failed"
    );
    return NextResponse.json(
      { error: "Could not draft a reply. Try again." },
      { status: 502 }
    );
  }
}
