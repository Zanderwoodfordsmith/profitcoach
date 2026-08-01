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
 *   - shredded lists, where only the first item stays a list item and every
 *     following item becomes lazy continuation text of the paragraph above it
 *     (see `repairShreddedLists`).
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
// A word char, closing bracket, or sentence-ending punctuation immediately
// before a bold span means a previous block ran into it
// (`...regularly.**Refinement**`, `### Features (F)**Step One**`).
const JAMMED_BEFORE_BOLD = /[A-Za-z0-9£$.!?;)]|[^\x00-\x7F]/;
// ...unless all that precedes it is a list marker, which owns the bold span.
const MARKER_ONLY = /^[ \t]*(?:\d+[.)]|[-*+])$/;

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
      if (prev && JAMMED_BEFORE_BOLD.test(prev) && !MARKER_ONLY.test(out)) {
        out += "\n\n";
      }

      out += `**${inner}**`;

      const next = line[closeAt + 2] ?? "";
      if (next) {
        if (STARTS_NEW_BLOCK.test(next)) {
          out += "\n\n";
        } else if (/[a-z]/.test(next) && !/^[A-Z]$/.test(inner)) {
          // Mid-sentence bold that lost its trailing space. A single capital
          // letter (`**D**elivery`) is an acronym heading, not mid-sentence.
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

/**
 * Google Docs breaks a sentence into two paragraphs around a bold span, leaving
 * `...you focused on` / `**Choosing Your Ideal Client**, a process where...`.
 * A paragraph that trails off mid-sentence into a bold span that resumes it
 * belongs back together.
 */
function joinMidSentenceBreaks(text: string): string {
  return text.replace(
    /([a-z,])[ \t]*\n[ \t]*\n(\*\*[^*\n]+\*\*)(?=[,;]|[ \t]+[a-z])/g,
    "$1 $2"
  );
}

/**
 * A heading marker swallowed by the end of the previous block, e.g.
 * `**Sending invoices**###**I** nterest Follow-up`. Skipped after `/` so URL
 * fragments are left alone.
 */
function splitJammedHeadings(text: string): string {
  return text.replace(
    /([^\s#/])(#{2,6})(?=\*\*|[ \t]*[A-Za-z])/g,
    (_m, before: string, hashes: string) => `${before}\n\n${hashes} `
  );
}

/** A list item at the start of a line: indent, marker, and body. */
const LIST_LINE = /^([ \t]*)([-*+]|\d+[.)])[ \t]+(.*)$/;
/** An item body that is only a bold label, e.g. `**Session Preparation:**`. */
const BOLD_LABEL_ONLY = /^\*\*[^*]+\*\*$/;
/** `---`, `* * *`, `___` — looks like a list item but is a horizontal rule. */
const THEMATIC_BREAK = /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

/** True for a line that can be folded into the list item above it. */
function isFoldableProse(line: string): boolean {
  // Nested list items and other indented blocks stay where they are. A single
  // leading space is usually a leftover non-breaking space from Google Docs,
  // not intentional nesting — treat those as foldable.
  if (/^[ \t]{2,}/.test(line) || /^\t/.test(line)) return false;
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(PROTECT_PREFIX)) return false;
  return (
    !isHeading(trimmed) &&
    !isListItem(trimmed) &&
    !isBoldOnly(trimmed) &&
    !THEMATIC_BREAK.test(trimmed) &&
    !/^[>|<!#]/.test(trimmed)
  );
}

type Line = { text: string; repaired: boolean };

/**
 * Rebuild lists that Turndown shredded on import. The stored shape is:
 *
 *     1.  **Session Preparation:**
 *
 *     Allocate time to prepare materials.
 *         2.**Learning Coaching Content:**
 *
 * Only the first item survives as a list item. Its description becomes a
 * separate unindented paragraph, and every later item becomes lazy continuation
 * text of that paragraph. Rendered, the markers indent but their descriptions
 * don't, and the gaps land between label and description instead of between
 * items.
 *
 * The repair straightens the markers, folds each label back together with the
 * description that belongs to it, and renumbers the runs it touched.
 */
function repairShreddedLists(text: string): string {
  const straightened: Line[] = text.split("\n").map((raw) => {
    if (THEMATIC_BREAK.test(raw)) return { text: raw, repaired: false };
    const line = raw
      // Phantom indent that turned later items into continuation text.
      .replace(/^[ \t]+(?=(?:\d+[.)]|[-*+])\*\*)/, "")
      // A doubled marker (`2.  1.  Current network`) is a nested list that got
      // flattened; restore the nesting and drop the outer marker.
      .replace(/^[ \t]*(?:\d+[.)]|[-*+])[ \t]+(\d+[.)]|[-*+])[ \t]+/, "    $1 ")
      // Restore the space the bold span ate, so this parses as a list item.
      .replace(/^(\d+[.)]|[-*+])(?=\*\*)/, "$1 ");
    return { text: line, repaired: line !== raw };
  });

  const folded: Line[] = [];
  for (let i = 0; i < straightened.length; i += 1) {
    const current = straightened[i];
    const item = LIST_LINE.exec(current.text);
    const label = item?.[3].trim() ?? "";
    if (!item || !BOLD_LABEL_ONLY.test(label)) {
      folded.push(current);
      continue;
    }

    let next = i + 1;
    while (next < straightened.length && isBlank(straightened[next].text)) next += 1;

    // A label with no body of its own, trailed by a detached paragraph, is the
    // shredded shape — the paragraph is that item's description.
    if (next < straightened.length && isFoldableProse(straightened[next].text)) {
      folded.push({
        text: `${item[1]}${item[2]} ${label} ${straightened[next].text.trim()}`,
        repaired: true,
      });
      i = next;
      continue;
    }
    folded.push(current);
  }

  // Keep each repaired run as one block: a blank line between two items would
  // otherwise survive as a loose list with uneven gaps.
  const tightened = folded.filter((line, i) => {
    if (!isBlank(line.text)) return true;
    const prev = folded[i - 1];
    const after = folded[i + 1];
    if (!prev || !after) return true;
    if (!LIST_LINE.test(prev.text) || !LIST_LINE.test(after.text)) return true;
    return !prev.repaired && !after.repaired;
  });

  renumberRepairedRuns(tightened);

  return tightened.map((line) => line.text).join("\n");
}

/**
 * Markers on imported lists are unreliable (2, 2, 3, 4), and markdown renders
 * whatever the first one says. Renumber from 1, but only runs this pass changed,
 * so hand-written lists that deliberately start mid-count are left alone.
 */
function renumberRepairedRuns(lines: Line[]): void {
  let run: Line[] = [];

  const flush = () => {
    const top = run.filter((line) => /^\d+[.)][ \t]/.test(line.text));
    if (top.length > 1 && run.some((line) => line.repaired)) {
      top.forEach((line, offset) => {
        line.text = line.text
          .replace(/^\d+([.)])[ \t]+/, `${offset + 1}$1 `)
          // Trailing hard breaks separated the shredded items; they're noise now.
          .replace(/[ \t]+$/, "");
      });
    }
    run = [];
  };

  for (let i = 0; i <= lines.length; i += 1) {
    const item = i < lines.length ? LIST_LINE.exec(lines[i].text) : null;
    // Nested items belong to the run above them but keep their own numbering.
    if (item && item[1] !== "") {
      if (run.length > 0) run.push(lines[i]);
      continue;
    }
    if (item && /^\d/.test(item[2])) {
      run.push(lines[i]);
      continue;
    }
    flush();
  }
}

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

  // Google Docs sprinkles non-breaking spaces, which defeat every whitespace
  // rule below and wrap badly in narrow columns.
  text = text.replace(/\u00a0/g, " ");

  const { text: protectedText, store } = protect(text);
  text = protectedText;

  // Google Docs escapes punctuation: \! \- \> etc.
  text = text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");

  // Collapse runs of 4+ asterisks (keep valid `***bold italic***`).
  text = text.replace(/\*{4,}/g, "**");

  // A heading marker stuck to a bold span (`###**Title**`) needs its space.
  text = text.replace(/^(#{1,6})(?=\*)/gm, "$1 ");
  text = splitJammedHeadings(text);

  // An acronym heading emphasising its first letter (`### **D** elivery:`) gains
  // a stray space on import, so it reads as "D elivery".
  text = text.replace(
    /^(#{1,6}[ \t]*\*\*[A-Z]\*\*)[ \t]+(?=[a-z]{2})/gm,
    "$1"
  );

  // Whitespace-only lines are blank lines as far as block structure goes.
  text = text.replace(/^[ \t]+$/gm, "");

  text = joinMidSentenceBreaks(text);

  // Trim inner spaces, split jammed spans, and drop dangling `**` per line.
  text = text
    .split("\n")
    .map((line) => splitJammedBoldAndBalance(line))
    .join("\n");

  text = repairShreddedLists(text);
  text = ensureBlockSpacing(text);

  // Collapse 3+ blank lines down to a single blank line.
  text = text.replace(/\n{3,}/g, "\n\n");

  text = restore(text.trim(), store);

  return text;
}
