import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { buildSystemPrompt } from "@/lib/messageGeneratorPrompt";

export const runtime = "nodejs";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

type ClientMessage = { role: "user" | "assistant"; content: string };

function toAnthropicMessages(messages: ClientMessage[]) {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is not configured with ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = (body as { messages?: ClientMessage[] }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Expected a non-empty messages array." },
      { status: 400 },
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
        { status: 400 },
      );
    }
  }

  if (messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from the user." },
      { status: 400 },
    );
  }

  let system: string;
  try {
    system = buildSystemPrompt();
  } catch (err) {
    console.error("[message-generator] buildSystemPrompt failed:", err);
    return NextResponse.json(
      {
        error:
          "Could not load messaging knowledge on the server. Try redeploying the latest build.",
      },
      { status: 500 },
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
          /* already closed */
        }
      }
      function fail(err: unknown) {
        if (closed) return;
        closed = true;
        try {
          controller.error(err instanceof Error ? err : new Error(String(err)));
        } catch {
          /* ignore */
        }
      }

      stream.on("text", (delta) => {
        try {
          controller.enqueue(encoder.encode(delta));
        } catch {
          /* stream consumer dropped */
        }
      });
      stream.on("error", fail);
      try {
        await stream.finalMessage();
        finish();
      } catch (err) {
        fail(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
