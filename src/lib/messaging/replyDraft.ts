import Anthropic from "@anthropic-ai/sdk";
import { loadEnrichedProspectById } from "@/lib/prospects/loadEnrichedProspect";
import { loadThreadMessagePage } from "@/lib/messaging/loadThreadMessages";
import {
  clipReplyCopilotNotes,
  composeReplyCopilotSystem,
  composeReplyCopilotUserMessage,
  maxTokensForChannel,
  resolveReplyCopilotModel,
  sanitizeCopilotSuggestion,
  selectCopilotThreadWindow,
  type CopilotThreadMessage,
  type ReplyCopilotChannel,
} from "@/lib/messaging/replyCopilot";
import {
  assembleReplyCopilotKnowledge,
  resolveReplyCopilotRouter,
} from "@/lib/messaging/replyCopilotKnowledge";
import { loadBrandKnowledgeOverrides } from "@/lib/profitCoachAi/brandKnowledge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ReplyDraftResult =
  | { ok: true; suggestion: string; messages: CopilotThreadMessage[] }
  | { ok: false; status: number; error: string };

function textFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Draft one reply for a conversation the caller has already authorised.
 * Suggest-only: this never sends anything. Thread and prospect facts are
 * quoted as untrusted data inside the user message.
 */
export async function draftReplyForConversation(input: {
  conversationId: string;
  coachId: string;
  contactId: string | null;
  channel: ReplyCopilotChannel;
  /** Extra steer for Ava, e.g. the recommended next step. Admin-written, trusted. */
  steer?: string | null;
}): Promise<ReplyDraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, status: 503, error: "Reply suggestions are not configured." };
  }

  const page = await loadThreadMessagePage({
    conversationId: input.conversationId,
    limit: 40,
  });
  if (page.error) {
    console.error("reply draft thread:", page.error);
    return { ok: false, status: 500, error: "Could not load messages." };
  }

  const threadMessages: CopilotThreadMessage[] = page.messages.map((row) => ({
    id: String(row.id ?? ""),
    channel: typeof row.channel === "string" ? row.channel : null,
    direction: typeof row.direction === "string" ? row.direction : null,
    body_text: typeof row.body_text === "string" ? row.body_text : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  }));
  const windowed = selectCopilotThreadWindow(threadMessages, input.channel);
  if (windowed.length === 0) {
    return { ok: false, status: 400, error: "No recent messages to reply to." };
  }

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

  if (input.contactId) {
    const loaded = await loadEnrichedProspectById(input.contactId, {
      coachId: input.coachId,
    });
    const { data: extra } = await supabaseAdmin
      .from("contacts")
      .select("reply_disposition")
      .eq("id", input.contactId)
      .eq("coach_id", input.coachId)
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
          typeof extra?.reply_disposition === "string" ? extra.reply_disposition : null,
      };
    }
  }

  const [{ data: settings }, notesRes, { data: profile }, overrides] = await Promise.all([
    supabaseAdmin
      .from("reply_copilot_settings")
      .select("system_prompt, model")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("coaches")
      .select("reply_copilot_notes")
      .eq("id", input.coachId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, first_name")
      .eq("id", input.coachId)
      .maybeSingle(),
    loadBrandKnowledgeOverrides(),
  ]);

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

  const { router } = resolveReplyCopilotRouter({
    storedPrompt: typeof settings?.system_prompt === "string" ? settings.system_prompt : "",
    overrides,
  });
  const { markdown: knowledge } = assembleReplyCopilotKnowledge({
    disposition: prospectFacts?.replyDisposition ?? null,
    bossScore: prospectFacts?.bossScore ?? null,
    overrides,
  });

  const system = composeReplyCopilotSystem({
    adminVoice: input.steer ? `${router}\n\n## Steer for this reply\n\n${input.steer}` : router,
    coachNotes: coachNotes || null,
    knowledge,
  });
  const user = composeReplyCopilotUserMessage({
    channel: input.channel,
    coachName,
    messages: windowed,
    prospect: prospectFacts,
  });

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: resolveReplyCopilotModel(typeof settings?.model === "string" ? settings.model : null),
      max_tokens: maxTokensForChannel(input.channel),
      system,
      messages: [{ role: "user", content: user }],
    });
    const suggestion = sanitizeCopilotSuggestion(textFromMessage(response));
    if (!suggestion) {
      return { ok: false, status: 502, error: "Could not draft a reply. Try again." };
    }
    return { ok: true, suggestion, messages: windowed };
  } catch (err) {
    console.error("reply draft anthropic:", err instanceof Error ? err.message : "failed");
    return { ok: false, status: 502, error: "Could not draft a reply. Try again." };
  }
}
