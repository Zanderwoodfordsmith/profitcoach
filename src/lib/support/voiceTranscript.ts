import { parseStoredCommunityPostMedia, type CommunityPostMediaItem } from "@/lib/communityPostMedia";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Whisper takes about 25 MB of audio; a voice note is far smaller. */
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** Speech to text with Cloudflare Workers AI Whisper. Null when it can't. */
export async function transcribeAudio(bytes: Uint8Array): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
  if (!accountId || !token || bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO_BYTES) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ audio: Buffer.from(bytes).toString("base64") }),
        signal: AbortSignal.timeout(45_000),
      }
    );
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; result?: { text?: string } };
    const text = res.ok && data.success !== false ? data.result?.text?.trim() : "";
    return text || null;
  } catch (err) {
    console.warn("voice transcript:", err);
    return null;
  }
}

const TABLES = ["community_feedback_replies", "community_feedback_reports"] as const;

/**
 * The transcript of one Support voice note, by its file link. Made the first
 * time it's asked for and saved on the message, so it runs once. Only an
 * admin or the coach whose chat it is may ask.
 */
export async function supportVoiceTranscript(input: {
  url: string;
  userId: string;
  isAdmin: boolean;
}): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  for (const table of TABLES) {
    const { data: row } = await supabaseAdmin
      .from(table)
      .select(table === "community_feedback_replies" ? "id, media, report_id" : "id, media, created_by")
      .contains("media", JSON.stringify([{ url: input.url }]))
      .limit(1)
      .maybeSingle();
    if (!row) continue;
    const r = row as unknown as { id: string; media: unknown; report_id?: string; created_by?: string };

    if (!input.isAdmin) {
      let ownerId = r.created_by ?? null;
      if (r.report_id) {
        const { data: report } = await supabaseAdmin
          .from("community_feedback_reports")
          .select("created_by")
          .eq("id", r.report_id)
          .maybeSingle();
        ownerId = (report?.created_by as string | undefined) ?? null;
      }
      if (ownerId !== input.userId) return { ok: false, status: 403, error: "Not your chat." };
    }

    const media = parseStoredCommunityPostMedia(r.media) ?? [];
    const item = media.find((m) => m.url === input.url);
    if (!item || item.kind !== "audio") return { ok: false, status: 404, error: "No voice note here." };
    if (item.transcript) return { ok: true, text: item.transcript };

    const audio = await fetch(input.url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!audio?.ok) return { ok: false, status: 502, error: "Couldn't open the voice note." };
    const text = await transcribeAudio(new Uint8Array(await audio.arrayBuffer()));
    if (!text) return { ok: false, status: 502, error: "Couldn't make a transcript. Try again." };

    const next: CommunityPostMediaItem[] = media.map((m) => (m.url === input.url ? { ...m, transcript: text } : m));
    await supabaseAdmin.from(table).update({ media: next }).eq("id", r.id);
    return { ok: true, text };
  }
  return { ok: false, status: 404, error: "No voice note here." };
}
