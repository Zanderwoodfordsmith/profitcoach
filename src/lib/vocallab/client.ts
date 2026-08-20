const VOCALLAB_BASE = "https://api.vocallab.ai";

/** VocalLab synthesizes one request at a time; longer scripts must be split. */
export const VOCALLAB_MAX_CHARS = 2000;

/** Base64 sample size cap from VocalLab (~6 MB decoded). */
export const VOCALLAB_MAX_SAMPLE_BASE64 = 8_000_000;

type VocallabErrorBody = {
  error?: { code?: string; message?: string } | string;
};

export type VocallabTtsResponse = {
  id: string;
  status: string;
  audio_base64?: string | null;
  audio_url?: string | null;
  stream_url?: string | null;
  format?: string;
  model?: string;
  points_used?: number;
};

export type VocallabCloneResponse = {
  id: string;
  name: string;
  type: string;
  languages?: string[];
  created_at?: string;
  used?: number;
  limit?: number;
  audio_notes?: string[];
};

function authHeaders(apiKey: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function readVocallabJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error(`VocalLab returned an empty reply (${response.status}).`);
  }

  let body: T & VocallabErrorBody;
  try {
    body = JSON.parse(text) as T & VocallabErrorBody;
  } catch {
    throw new Error(`VocalLab returned a non-JSON reply (${response.status}).`);
  }

  if (!response.ok) {
    const err = body.error;
    const message =
      (typeof err === "object" && err?.message) ||
      (typeof err === "string" ? err : null) ||
      `VocalLab request failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

function decodeAudioBase64(audioBase64: string): {
  bytes: Buffer;
  mime: string;
  ext: string;
} {
  const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(audioBase64);
  const mime = dataUrlMatch?.[1]?.trim() || "audio/mpeg";
  const payload = dataUrlMatch?.[2] ?? audioBase64.replace(/^data:[^,]*,/, "");
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length) {
    throw new Error("VocalLab returned empty audio.");
  }
  const ext = mime.includes("wav") ? ".wav" : ".mp3";
  return { bytes, mime, ext };
}

/**
 * Split a long script into VocalLab-sized pieces at sentence / paragraph breaks.
 */
export function splitScriptForVocallab(
  text: string,
  maxChars = VOCALLAB_MAX_CHARS
): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let remaining = cleaned;

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const breakAt =
      Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("! "),
        window.lastIndexOf("? "),
        window.lastIndexOf("\n"),
        window.lastIndexOf("; "),
        window.lastIndexOf(", ")
      ) + 1;

    const cut = breakAt > maxChars * 0.4 ? breakAt : maxChars;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

export async function generateVocallabSpeech(
  apiKey: string,
  input: {
    text: string;
    voice: string;
    model?: string;
    format?: "MP3" | "WAV";
  }
): Promise<{
  id: string;
  bytes: Buffer;
  mime: string;
  filename: string;
  pointsUsed: number;
}> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("Paste a script before generating speech.");
  }
  if (text.length > VOCALLAB_MAX_CHARS) {
    throw new Error(
      `VocalLab accepts up to ${VOCALLAB_MAX_CHARS} characters per request. Split the script and try again.`
    );
  }

  const response = await fetch(`${VOCALLAB_BASE}/api/v1/tts`, {
    method: "POST",
    headers: authHeaders(apiKey, true),
    body: JSON.stringify({
      text,
      voice: input.voice,
      model: input.model ?? "v-pro",
      format: input.format ?? "MP3",
    }),
  });

  const data = await readVocallabJson<VocallabTtsResponse>(response);
  if (!data.audio_base64) {
    throw new Error(
      "VocalLab finished without returning audio. Try again in a moment."
    );
  }

  const { bytes, mime, ext } = decodeAudioBase64(data.audio_base64);
  return {
    id: data.id,
    bytes,
    mime,
    filename: `vocallab-${data.id}${ext}`,
    pointsUsed: data.points_used ?? 0,
  };
}

export async function cloneVocallabVoice(
  apiKey: string,
  input: {
    name: string;
    language: string;
    audioBase64: string;
    transcript?: string;
    removeBackgroundNoise?: boolean;
  }
): Promise<VocallabCloneResponse> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Give this voice a name before cloning.");
  }
  if (!input.audioBase64) {
    throw new Error("Record or upload a voice sample before cloning.");
  }
  if (input.audioBase64.length > VOCALLAB_MAX_SAMPLE_BASE64) {
    throw new Error("That recording is too large. Keep it under about 30 seconds.");
  }

  const response = await fetch(`${VOCALLAB_BASE}/api/v1/voices/clones`, {
    method: "POST",
    headers: authHeaders(apiKey, true),
    body: JSON.stringify({
      name,
      language: input.language,
      samples: [
        {
          audio_base64: input.audioBase64,
          ...(input.transcript?.trim()
            ? { transcript: input.transcript.trim() }
            : {}),
        },
      ],
      remove_background_noise: input.removeBackgroundNoise ?? true,
    }),
  });

  return readVocallabJson<VocallabCloneResponse>(response);
}

export async function deleteVocallabClone(
  apiKey: string,
  voiceId: string
): Promise<void> {
  const id = voiceId.trim();
  if (!id) return;

  const response = await fetch(
    `${VOCALLAB_BASE}/api/v1/voices/clones/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: authHeaders(apiKey),
    }
  );

  if (response.status === 404) return;
  await readVocallabJson<{ ok?: boolean }>(response);
}
