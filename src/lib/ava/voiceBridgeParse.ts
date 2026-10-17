/** OpenAI-shaped messages, as ElevenLabs sends them to a custom LLM. */

export type BridgeContentPart = { type?: string; text?: string };

export type BridgeMessage = {
  role?: string;
  content?: string | BridgeContentPart[] | null;
};

export type BridgeExtra = {
  ava_auth?: string;
  ava_coach_id?: string | null;
};

export function contentToText(content: BridgeMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (part?.type === "text" ? (part.text ?? "") : "")).join("");
  }
  return "";
}

/** The newest thing the coach said. Empty when ElevenLabs is asking Ava to open. */
export function latestUserText(messages: BridgeMessage[] | undefined, max = 8000): string {
  const list = messages ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.role !== "user") continue;
    const text = contentToText(list[i]?.content).trim();
    if (text) return text.slice(0, max);
  }
  return "";
}

export function bridgeExtra(body: (BridgeExtra & { elevenlabs_extra_body?: BridgeExtra }) | null): BridgeExtra {
  const nested = body?.elevenlabs_extra_body;
  return {
    ava_auth: body?.ava_auth ?? nested?.ava_auth,
    ava_coach_id: body?.ava_coach_id ?? nested?.ava_coach_id ?? null,
  };
}
