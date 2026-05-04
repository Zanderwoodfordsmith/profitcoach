import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  assembleProfitCoachSystemPrompt,
  playbookExcerptForOutput,
} from "@/lib/profitCoachAi/assemblePrompt";
import { getDefaultOutputId, getOutputById } from "@/lib/profitCoachAi/registry";
import {
  loadCoachAiContextRow,
  loadCompassSummaryForUser,
} from "@/lib/profitCoachAi/loadCoachPromptContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { requireCoachEffectiveId } from "./_auth";

export const runtime = "nodejs";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

type ClientMessage = { role: "user" | "assistant"; content: string };

function toAnthropicMessages(messages: ClientMessage[]) {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is not configured with ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  const auth = await requireCoachEffectiveId(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const coachId = auth.userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = body as {
    messages?: ClientMessage[];
    chatId?: string;
    outputId?: string;
    roleId?: string | null;
  };

  const messages = b.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Expected a non-empty messages array." },
      { status: 400 }
    );
  }

  for (const m of messages) {
    if (
      !m ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Each message must have role user|assistant and string content.",
        },
        { status: 400 }
      );
    }
  }

  if (messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from the user." },
      { status: 400 }
    );
  }

  const outputIdRaw = typeof b.outputId === "string" ? b.outputId.trim() : "";
  const outputId =
    outputIdRaw && getOutputById(outputIdRaw) ? outputIdRaw : getDefaultOutputId();

  const roleId =
    typeof b.roleId === "string" && b.roleId.trim() ? b.roleId.trim() : null;

  let chatId =
    typeof b.chatId === "string" && b.chatId.trim() ? b.chatId.trim() : null;
  let createdChatId: string | null = null;

  if (chatId) {
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("profit_coach_ai_chats")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", coachId)
      .maybeSingle();

    if (exErr || !existing) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }
  } else {
    const now = new Date().toISOString();
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("profit_coach_ai_chats")
      .insert({
        user_id: coachId,
        title: "New chat",
        last_output_id: outputId,
        last_role_id: roleId,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error("profit-coach-ai create chat:", insErr);
      return NextResponse.json(
        { error: "Could not create chat." },
        { status: 500 }
      );
    }
    chatId = inserted.id as string;
    createdChatId = chatId;
  }

  const [brain, compassText, playbookExcerptText, priorCountRes] = await Promise.all([
    loadCoachAiContextRow(coachId),
    loadCompassSummaryForUser(coachId),
    Promise.resolve(playbookExcerptForOutput(outputId)),
    supabaseAdmin
      .from("profit_coach_ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chatId!),
  ]);

  const priorMessageCount = priorCountRes.count ?? 0;

  let system: string;
  try {
    system = assembleProfitCoachSystemPrompt({
      outputId,
      roleId,
      playbookExcerptText,
      brain: brain ?? {},
      compassContext: compassText,
    });
  } catch (e) {
    console.error("[profit-coach-ai] assemblePrompt failed:", e);
    return NextResponse.json(
      { error: "Could not build system prompt." },
      { status: 500 }
    );
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const anthropic = new Anthropic({ apiKey });

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 8192,
    system,
    messages: toAnthropicMessages(messages),
  });

  const lastUser = messages[messages.length - 1]!.content;
  let fullAssistant = "";

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      function finish() {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
      function fail(err: unknown) {
        if (closed) return;
        closed = true;
        try {
          controller.error(err instanceof Error ? err : new Error(String(err)));
        } catch {
          /* noop */
        }
      }

      stream.on("text", (delta) => {
        fullAssistant += delta;
        try {
          controller.enqueue(encoder.encode(delta));
        } catch {
          /* dropped */
        }
      });
      stream.on("error", fail);
      try {
        await stream.finalMessage();

        const now = new Date().toISOString();
        const chatUpdate: Record<string, unknown> = {
          updated_at: now,
          last_output_id: outputId,
          last_role_id: roleId,
        };

        if (priorMessageCount === 0) {
          chatUpdate.title =
            lastUser.slice(0, 72) + (lastUser.length > 72 ? "…" : "");
        }

        await supabaseAdmin
          .from("profit_coach_ai_chats")
          .update(chatUpdate)
          .eq("id", chatId!)
          .eq("user_id", coachId);

        await supabaseAdmin.from("profit_coach_ai_messages").insert([
          { chat_id: chatId!, role: "user", content: lastUser, created_at: now },
          {
            chat_id: chatId!,
            role: "assistant",
            content: fullAssistant,
            created_at: now,
          },
        ]);

        finish();
      } catch (err) {
        fail(err);
      }
    },
  });

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Chat-Id": chatId!,
  });
  if (createdChatId) {
    headers.set("X-New-Chat-Id", createdChatId);
  }

  return new Response(readable, { headers });
}
