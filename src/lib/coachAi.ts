/**
 * Coaching AI: chat with Claude using admin-configured system prompt.
 * Separate from insightGenerator (Insight AI); used for client-facing coaching conversations.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

export type SectionContext = {
  tab: "levels" | "pillars" | "areas";
  levelIdx?: number;
  pillarIdx?: number;
  areaIdx?: number;
  insightTitle: string;
  insightBody: string;
  priorityPlaybooks?: { ref: string; name: string; status: number }[];
};

function buildSectionContextBlock(section: SectionContext): string {
  const parts: string[] = [
    "The user is asking for coaching in the context of a specific part of their Profit System dashboard:",
    `- Tab: ${section.tab}`,
    `- Insight title: ${section.insightTitle}`,
    `- Insight summary: ${section.insightBody.slice(0, 800)}${section.insightBody.length > 800 ? "…" : ""}`,
  ];
  if (section.levelIdx != null) {
    const levelNames: Record<number, string> = {
      0: "Level 1 — Overwhelm",
      1: "Level 2 — Overworked",
      2: "Level 3 — Organised",
      3: "Level 4 — Overseer",
      4: "Level 5 — Owner",
    };
    parts.push(`- Level: ${levelNames[section.levelIdx] ?? `Level ${section.levelIdx + 1}`}`);
  }
  if (section.pillarIdx != null) {
    const pillarNames = ["Foundation", "Clarify Vision", "Control Velocity", "Create Value"];
    parts.push(`- Pillar: ${pillarNames[section.pillarIdx] ?? `Pillar ${section.pillarIdx}`}`);
  }
  if (section.areaIdx != null) {
    parts.push(`- Area index: ${section.areaIdx}`);
  }
  if (section.priorityPlaybooks?.length) {
    parts.push(
      "Priority playbooks for this section: " +
        section.priorityPlaybooks.map((p) => `${p.name} (${p.ref})`).join(", ")
    );
  }
  return parts.join("\n");
}

export function buildSystemMessage(basePrompt: string, sectionContext?: SectionContext | null): string {
  if (!sectionContext) return basePrompt;
  const block = buildSectionContextBlock(sectionContext);
  return `${basePrompt}\n\n---\nCONTEXT FOR THIS CONVERSATION:\n${block}`;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function getAssistantReply(
  systemMessage: string,
  messages: ChatMessage[]
): Promise<{ content: string; error?: string }> {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/bba1adf9-ecf5-4171-8b75-fa8976277b63", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "coachAi.ts:getAssistantReply entry",
      message: "System message passed to Anthropic",
      data: {
        systemMessagePreview: (systemMessage ?? "").slice(0, 150),
        systemMessageLength: (systemMessage ?? "").length,
        messageCount: messages?.length ?? 0,
      },
      timestamp: Date.now(),
      hypothesisId: "H4",
    }),
  }).catch(() => {});
  // #endregion

  const apiKey =
    process.env.ANTHROPIC_COACH_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { content: "", error: "Coaching AI is not configured." };
  }

  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemMessage,
        messages: anthropicMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("CoachAI: API error", response.status, errText);
      return { content: "", error: "The coach is temporarily unavailable." };
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    return { content: text };
  } catch (err) {
    console.error("CoachAI: Request failed", err);
    return { content: "", error: "The coach is temporarily unavailable." };
  }
}
