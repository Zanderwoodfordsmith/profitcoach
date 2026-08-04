import Anthropic from "@anthropic-ai/sdk";
import { resolveAnthropicModel } from "@/lib/anthropicModel";

/**
 * Non-streaming JSON generation for First Campaign Setup steps.
 * Expects the model to return a single JSON object (optionally fenced).
 */
export async function generateCampaignJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ data: T | null; raw: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { data: null, raw: "", error: "ANTHROPIC_API_KEY is not configured." };
  }

  const anthropic = new Anthropic({ apiKey });
  const model = resolveAnthropicModel();
  const maxTokens = opts.maxTokens ?? 4096;

  try {
    const first = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });

    let raw = textFromMessage(first);
    let parsed = parseJsonLoose<T>(raw);

    // Truncated JSON is the usual failure mode for large avatar payloads.
    if (parsed == null && first.stop_reason === "max_tokens") {
      const cont = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: opts.system,
        messages: [
          { role: "user", content: opts.user },
          { role: "assistant", content: raw },
          {
            role: "user",
            content:
              "Continue the JSON exactly where you left off. Output only the remainder needed to produce one valid JSON object — no markdown fences, no commentary.",
          },
        ],
      });
      raw = `${raw}${textFromMessage(cont)}`;
      parsed = parseJsonLoose<T>(raw);
    }

    // One repair pass if still invalid.
    if (parsed == null && raw.trim()) {
      const repair = await anthropic.messages.create({
        model,
        max_tokens: Math.min(maxTokens, 8192),
        system:
          "You fix broken JSON. Return ONLY one valid JSON object. No markdown fences, no commentary.",
        messages: [
          {
            role: "user",
            content: `Fix this into valid JSON matching the original schema intent:\n\n${raw.slice(0, 60_000)}`,
          },
        ],
      });
      const repaired = textFromMessage(repair);
      parsed = parseJsonLoose<T>(repaired);
      if (parsed != null) raw = repaired;
    }

    if (parsed == null) {
      const reason = first.stop_reason === "max_tokens" ? " (response truncated)" : "";
      return {
        data: null,
        raw,
        error: `Model did not return valid JSON${reason}.`,
      };
    }
    return { data: parsed, raw };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Anthropic request failed.";
    console.error("[generateCampaignJson]", message);
    return { data: null, raw: "", error: message };
  }
}

function textFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function parseJsonLoose<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // fall through
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      // Try a light trailing-comma / truncated-string cleanup
      const sliced = candidate.slice(start, end + 1);
      const cleaned = sliced
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/\n/g, "\n");
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        return null;
      }
    }
  }

  const aStart = candidate.indexOf("[");
  const aEnd = candidate.lastIndexOf("]");
  if (aStart >= 0 && aEnd > aStart) {
    try {
      return JSON.parse(candidate.slice(aStart, aEnd + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}
