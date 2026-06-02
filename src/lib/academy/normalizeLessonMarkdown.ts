/**
 * Repairs malformed lesson markdown so it renders cleanly in AcademyMarkdown
 * (react-markdown + remark-gfm, no `breaks`).
 *
 * The content was largely pasted from Google Docs / Disco through Turndown,
 * which produced glitches such as:
 *   - runs of 4+ asterisks: `****Congratulations.****`
 *   - bold runs jammed straight into surrounding text with no separation:
 *     `Different****This isn't another coaching course.****Most programs...`
 *   - missing blank lines between blocks, so headings/paragraphs collapse onto
 *     one line and the asterisks render literally.
 *
 * Fenced code blocks (including `html-embed`) and `<details>` accordions are
 * extracted and restored verbatim so embeds, colored text, and accordions are
 * never touched.
 */

const PROTECT_PREFIX = "\u0000LESSONMD";
const PROTECT_SUFFIX = "\u0000";

type Protected = { tokens: string[] };

/** Replace fenced code blocks and <details> accordions with placeholders. */
function protect(text: string): { text: string; store: Protected } {
  const store: Protected = { tokens: [] };

  const push = (chunk: string): string => {
    const token = `${PROTECT_PREFIX}${store.tokens.length}${PROTECT_SUFFIX}`;
    store.tokens.push(chunk);
    return token;
  };

  // Fenced code blocks (``` ... ```), incl. the html-embed language.
  let out = text.replace(/(`{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*(?=\n|$)/g, (m) => push(m));

  // <details> accordions stored as raw HTML.
  out = out.replace(/<details[\s\S]*?<\/details>/gi, (m) => push(m));

  return { text: out, store };
}

function restore(text: string, store: Protected): string {
  return text.replace(
    new RegExp(`${PROTECT_PREFIX}(\\d+)${PROTECT_SUFFIX}`, "g"),
    (_m, index: string) => store.tokens[Number(index)] ?? ""
  );
}

// A new block clearly starts after a bold span when the next char is an
// uppercase letter, digit, currency, or non-ASCII (emoji/heading glyph).
const STARTS_NEW_BLOCK = /[A-Z0-9£$]|[^\x00-\x7F]/;
// A word char immediately before/after a bold span means it was jammed in.
const WORD_CHAR = /[A-Za-z0-9£$]|[^\x00-\x7F]/;

/** True when a `**` delimiter sits at index i (and is not part of a `***` run). */
function isBoldDelimiter(line: string, i: number): boolean {
  return (
    line[i] === "*" &&
    line[i + 1] === "*" &&
    line[i - 1] !== "*" &&
    line[i + 2] !== "*"
  );
}

/**
 * Repair bold spans on a single line:
 *   - trim stray spaces inside the delimiters (`** text **` -> `**text**`)
 *   - split spans that abut surrounding words onto their own paragraphs, so
 *     collapsed faux-headings/lead-ins land on their own line
 *   - drop a dangling, unterminated `**`
 * Well-formed inline bold (`use **deep work** daily`) is left untouched.
 */
function splitJammedBoldAndBalance(line: string): string {
  if (!line.includes("**")) return line;

  let out = "";
  let i = 0;
  const n = line.length;

  while (i < n) {
    if (!isBoldDelimiter(line, i)) {
      out += line[i];
      i += 1;
      continue;
    }

    let closeAt = -1;
    for (let j = i + 2; j < n; j += 1) {
      if (isBoldDelimiter(line, j)) {
        closeAt = j;
        break;
      }
    }

    if (closeAt === -1) {
      // Dangling delimiter: drop it, keep the rest as plain text.
      out += line.slice(i + 2);
      break;
    }

    const inner = line.slice(i + 2, closeAt).trim();
    if (inner) {
      // A word char directly before the span (but not `[`/`(` of a link) means
      // a collapsed block ran into this one: separate them.
      const prev = out.length ? out[out.length - 1] : "";
      if (prev && WORD_CHAR.test(prev)) out += "\n\n";

      out += `**${inner}**`;

      const next = line[closeAt + 2] ?? "";
      if (next) {
        if (STARTS_NEW_BLOCK.test(next)) {
          out += "\n\n";
        } else if (/[a-z]/.test(next)) {
          // Mid-sentence bold that lost its trailing space.
          out += " ";
        }
        // Punctuation (`]`, `)`, `.`, `,`, etc.) stays attached.
      }
    }
    i = closeAt + 2;
  }

  return out;
}

const isHeading = (line: string) => /^#{1,6}\s/.test(line);
const isListItem = (line: string) => /^\s*([-*+]\s|\d+[.)]\s)/.test(line);
const isBlank = (line: string) => line.trim() === "";
/** A line that is nothing but a single bold span behaves like a faux heading. */
const isBoldOnly = (line: string) => /^\*\*(?:(?!\*\*).)+\*\*$/.test(line.trim());

/** Insert blank lines at heading and list boundaries that ended up adjacent. */
function ensureBlockSpacing(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const prev = out.length ? out[out.length - 1] : null;
    if (prev !== null && !isBlank(prev) && !isBlank(line)) {
      const boundary =
        isHeading(line) ||
        isHeading(prev) ||
        isBoldOnly(line) ||
        isBoldOnly(prev) ||
        (isListItem(line) && !isListItem(prev)) ||
        (isListItem(prev) && !isListItem(line));
      if (boundary) out.push("");
    }
    out.push(line);
  }

  return out.join("\n");
}

/** Normalize lesson markdown for display, editor preview, and stored cleanup. */
export function normalizeLessonMarkdown(raw: string): string {
  if (!raw) return "";

  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const { text: protectedText, store } = protect(text);
  text = protectedText;

  // Google Docs escapes punctuation: \! \- \> etc.
  text = text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");

  // Collapse runs of 4+ asterisks (keep valid `***bold italic***`).
  text = text.replace(/\*{4,}/g, "**");

  // A heading marker stuck to a bold span (`###**Title**`) needs its space.
  text = text.replace(/^(#{1,6})(?=\*)/gm, "$1 ");

  // Trim inner spaces, split jammed spans, and drop dangling `**` per line.
  text = text
    .split("\n")
    .map((line) => splitJammedBoldAndBalance(line))
    .join("\n");

  text = ensureBlockSpacing(text);

  // Collapse 3+ blank lines down to a single blank line.
  text = text.replace(/\n{3,}/g, "\n\n");

  text = restore(text.trim(), store);

  return text;
}
