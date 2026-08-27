/**
 * Remove auto-transcript speaker labels from lesson text.
 * Handles "Speaker A", "Speaker 1", and named labels like "Pam [00:00:00]:".
 * Preserves timestamps when they appear beside a speaker label.
 */

const TIMESTAMP =
  "(?:\\[\\d{1,2}:\\d{2}(?::\\d{2})?\\]|\\(\\d{1,2}:\\d{2}(?::\\d{2})?\\))";

const SPEAKER_NAME =
  "(?:Speaker\\s+[A-Za-z0-9]+|[A-Z][a-zA-Z'’.-]*(?:\\s+[A-Z][a-zA-Z'’.-]*){0,2})";

/** Speaker/name + timestamp alone — keep the clock. */
const SPEAKER_WITH_TIMESTAMP_LINE = new RegExp(
  `^\\s*${SPEAKER_NAME}\\s*(${TIMESTAMP})\\s*:?\\s*$`,
  "i"
);

/** Speaker/name + timestamp before dialogue — keep clock, keep dialogue. */
const SPEAKER_TIMESTAMP_PREFIX = new RegExp(
  `^\\s*${SPEAKER_NAME}\\s*(${TIMESTAMP})\\s*:?\\s*`,
  "i"
);

/** Line is only a generic "Speaker …" label (no dialogue). */
const SPEAKER_ONLY_LINE =
  /^\s*Speaker\s+[A-Za-z0-9]+\s*(?:\(\s*\d{1,2}:\d{2}(?::\d{2})?\s*\))?\s*[-–—:]?\s*$/i;

/** Older "Speaker 1:" style prefix without a timestamp. */
const SPEAKER_LABEL_PREFIX =
  /^\s*Speaker\s+[A-Za-z0-9]+\s*(?:\(\s*\d{1,2}:\d{2}(?::\d{2})?\s*\))?\s*[-–—:]?\s*/i;

const SPEAKER_BRACKET = /\[Speaker\s+[A-Za-z0-9]+\]\s*/gi;

function normalizeTimestampToken(token: string): string {
  const inner = token.replace(/^[\[(]|[\])]$/g, "");
  return `[${inner}]`;
}

export function stripTranscriptSpeakerLabels(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const withTsOnly = line.match(SPEAKER_WITH_TIMESTAMP_LINE);
    if (withTsOnly) {
      out.push(normalizeTimestampToken(withTsOnly[1]));
      continue;
    }

    const withTsPrefix = line.match(SPEAKER_TIMESTAMP_PREFIX);
    if (withTsPrefix) {
      out.push(normalizeTimestampToken(withTsPrefix[1]));
      const rest = line.slice(withTsPrefix[0].length).trim();
      if (rest) out.push(rest);
      continue;
    }

    if (SPEAKER_ONLY_LINE.test(line)) continue;

    const stripped = line.replace(SPEAKER_LABEL_PREFIX, "");
    if (stripped.trim()) out.push(stripped);
  }

  return out
    .join("\n")
    .replace(SPEAKER_BRACKET, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
