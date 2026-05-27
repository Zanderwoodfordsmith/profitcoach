/**
 * Remove auto-transcript speaker labels (Speaker 1, Speaker 2, etc.) from lesson text.
 */

/** Line is only a speaker label, optionally with a timestamp. */
const SPEAKER_ONLY_LINE =
  /^\s*Speaker\s*\d+\s*(?:\(\s*\d{1,2}:\d{2}(?::\d{2})?\s*\))?\s*[-–—:]?\s*$/i;

/** Speaker prefix at the start of a line before dialogue. */
const SPEAKER_LINE_PREFIX =
  /^\s*Speaker\s*\d+\s*(?:\(\s*\d{1,2}:\d{2}(?::\d{2})?\s*\))?\s*[-–—:]?\s*/i;

const SPEAKER_BRACKET = /\[Speaker\s*\d+\]\s*/gi;

export function stripTranscriptSpeakerLabels(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    if (SPEAKER_ONLY_LINE.test(line)) continue;
    const stripped = line.replace(SPEAKER_LINE_PREFIX, "");
    if (stripped.trim()) out.push(stripped);
  }

  return out
    .join("\n")
    .replace(SPEAKER_BRACKET, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
