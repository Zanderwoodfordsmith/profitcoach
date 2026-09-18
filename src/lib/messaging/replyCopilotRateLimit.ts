import { REPLY_COPILOT_RATE_PER_MIN } from "@/lib/messaging/replyCopilot";

const WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

/** In-memory per-key sliding window. Returns false when the caller should 429. */
export function consumeReplyCopilotRateLimit(
  key: string,
  now = Date.now()
): boolean {
  const id = key.trim();
  if (!id) return false;
  const recent = (hits.get(id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= REPLY_COPILOT_RATE_PER_MIN) {
    hits.set(id, recent);
    return false;
  }
  recent.push(now);
  hits.set(id, recent);
  return true;
}
