import { HappyScribeError } from "./error";

const MAX_PARAGRAPHS = 100_000;
const MAX_TRANSCRIPT_CHARS = 5_000_000;

type HappyScribeWord = {
  text: string;
  data_start?: number;
};

type HappyScribeParagraph = {
  data_start: number;
  data_end?: number;
  words?: HappyScribeWord[];
  text?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseWord(value: unknown): HappyScribeWord | null {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  const text = value.text.trim();
  if (!text || text.length > 10_000) return null;
  return {
    text,
    ...(finiteNonNegative(value.data_start) ? { data_start: value.data_start } : {}),
  };
}

function parseParagraph(value: unknown): HappyScribeParagraph | null {
  if (!isRecord(value) || !finiteNonNegative(value.data_start)) return null;
  const words = Array.isArray(value.words)
    ? value.words.flatMap((word) => {
        const parsed = parseWord(word);
        return parsed ? [parsed] : [];
      })
    : [];
  const text =
    words.length > 0
      ? words.map((word) => word.text).join(" ")
      : typeof value.text === "string"
        ? value.text.trim()
        : "";
  if (!text || text.length > 100_000) return null;
  return {
    data_start: value.data_start,
    data_end: finiteNonNegative(value.data_end) ? value.data_end : undefined,
    words,
    text,
  };
}

function paragraphsFromExport(value: unknown): HappyScribeParagraph[] {
  const raw = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.paragraphs)
      ? value.paragraphs
      : isRecord(value) && Array.isArray(value.transcript)
        ? value.transcript
        : null;
  if (!raw || raw.length > MAX_PARAGRAPHS) {
    throw new HappyScribeError("Happy Scribe export has an invalid transcript.", 502);
  }
  const paragraphs = raw.flatMap((paragraph) => {
    const parsed = parseParagraph(paragraph);
    return parsed ? [parsed] : [];
  });
  if (paragraphs.length === 0) {
    throw new HappyScribeError("Happy Scribe export contains no transcript text.", 502);
  }
  return paragraphs;
}

function timestamp(seconds: number): string {
  const total = Math.min(7 * 24 * 60 * 60 - 1, Math.max(0, Math.round(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `[${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}]`;
}

function joinWords(text: string): string {
  return text
    .replace(/\s+([,.;:!?%)\]}])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+'/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert Happy Scribe JSON paragraphs into the timestamped transcript format
 * consumed by the academy player: one `[hh:mm:ss] text` cue per paragraph.
 */
export function happyScribeExportToTranscript(value: unknown): string {
  const paragraphs = paragraphsFromExport(value);
  const transcript = paragraphs
    .map((paragraph) => `${timestamp(paragraph.data_start)} ${joinWords(paragraph.text ?? "")}`)
    .join("\n");
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new HappyScribeError("Happy Scribe transcript was too large.", 502);
  }
  return transcript;
}
