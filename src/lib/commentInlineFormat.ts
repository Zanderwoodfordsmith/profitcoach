/**
 * The two formats comments support: `**bold**` and `[label](url)` links.
 * The composer (MentionTextarea) and the renderer (MentionBody) share these
 * rules so a comment looks the same before and after it is posted.
 */

/**
 * Invisible wrapper around each link label in the composer (zero-width
 * non-joiner). The textarea holds `‌label‌`; URLs live in a separate array in
 * link order, so the nth marker pair belongs to the nth URL.
 */
export const LINK_MARKER = "‌";

export type LinkSpan = {
  /** Index of the opening marker. */
  open: number;
  /** Index of the closing marker. */
  close: number;
};

/** Marker pairs in order. A trailing marker with no partner is ignored. */
export function linkSpans(display: string): LinkSpan[] {
  const spans: LinkSpan[] = [];
  let open = -1;
  for (let i = 0; i < display.length; i++) {
    if (display[i] !== LINK_MARKER) continue;
    if (open === -1) {
      open = i;
    } else {
      spans.push({ open, close: i });
      open = -1;
    }
  }
  return spans;
}

/** Index of the link whose label holds the caret (or the whole selection), or -1. */
export function linkIndexAt(display: string, start: number, end = start): number {
  return linkSpans(display).findIndex((s) => start > s.open && end <= s.close);
}

function withoutIndexes(
  text: string,
  drop: Set<number>,
  caret: number
): { text: string; caret: number } {
  if (drop.size === 0) return { text, caret };
  let out = "";
  let nextCaret = caret;
  for (let i = 0; i < text.length; i++) {
    if (drop.has(i)) {
      if (i < caret) nextCaret--;
      continue;
    }
    out += text[i];
  }
  return { text: out, caret: nextCaret };
}

/**
 * Fixes link markers after a typed edit (typing, paste, cut, delete) and
 * returns the URLs that still belong to a link. A link that lost one marker
 * becomes plain text, pasted markers are dropped, and a link whose label was
 * emptied disappears. `caret` shifts by whatever was removed before it.
 */
export function reconcileLinkMarkers(
  prev: string,
  prevUrls: string[],
  next: string,
  caret: number
): { display: string; urls: string[]; caret: number } {
  const shorter = Math.min(prev.length, next.length);
  let head = 0;
  while (head < shorter && prev[head] === next[head]) head++;
  let tail = 0;
  while (
    tail < shorter - head &&
    prev[prev.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail++;
  }
  // prev[head, prevEnd) was replaced by next[head, nextEnd).
  const prevEnd = prev.length - tail;
  const nextEnd = next.length - tail;
  const kept = (i: number) => i < head || i >= prevEnd;
  const toNext = (i: number) => (i < head ? i : i + next.length - prev.length);

  const drop = new Set<number>();
  for (let i = head; i < nextEnd; i++) {
    if (next[i] === LINK_MARKER) drop.add(i);
  }
  const keptUrls: string[] = [];
  linkSpans(prev).forEach((span, idx) => {
    const openKept = kept(span.open);
    const closeKept = kept(span.close);
    if (openKept && closeKept) {
      keptUrls.push(prevUrls[idx] ?? "");
      return;
    }
    if (openKept) drop.add(toNext(span.open));
    if (closeKept) drop.add(toNext(span.close));
  });
  const first = withoutIndexes(next, drop, caret);

  // Empty links, plus any stray marker without a partner.
  const drop2 = new Set<number>();
  const paired = new Set<number>();
  const urls: string[] = [];
  linkSpans(first.text).forEach((span, idx) => {
    paired.add(span.open);
    paired.add(span.close);
    if (span.close === span.open + 1) {
      drop2.add(span.open);
      drop2.add(span.close);
    } else {
      urls.push(keptUrls[idx] ?? "");
    }
  });
  for (let i = 0; i < first.text.length; i++) {
    if (first.text[i] === LINK_MARKER && !paired.has(i)) drop2.add(i);
  }
  const second = withoutIndexes(first.text, drop2, first.caret);
  return { display: second.text, urls, caret: second.caret };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * Backspace/Delete beside a link marker would remove an invisible character
 * and seem to do nothing. Returns the edit that removes the visible character
 * past the marker(s) instead, or null when no marker is beside the caret.
 */
export function deleteBesideLinkMarker(
  display: string,
  caret: number,
  direction: "backward" | "forward"
): { display: string; caret: number } | null {
  if (direction === "backward") {
    if (caret === 0 || display[caret - 1] !== LINK_MARKER) return null;
    let k = caret - 1;
    while (k > 0 && display[k - 1] === LINK_MARKER) k--;
    if (k === 0) return { display, caret };
    const from =
      k >= 2 &&
      isLowSurrogate(display.charCodeAt(k - 1)) &&
      isHighSurrogate(display.charCodeAt(k - 2))
        ? k - 2
        : k - 1;
    return {
      display: display.slice(0, from) + display.slice(k),
      caret: caret - (k - from),
    };
  }
  if (display[caret] !== LINK_MARKER) return null;
  let k = caret;
  while (k < display.length && display[k] === LINK_MARKER) k++;
  if (k === display.length) return { display, caret };
  const to =
    isHighSurrogate(display.charCodeAt(k)) &&
    isLowSurrogate(display.charCodeAt(k + 1))
      ? k + 2
      : k + 1;
  return { display: display.slice(0, k) + display.slice(to), caret };
}

/** `**bold**`: no space just inside the stars, and on one line. */
const BOLD_SOURCE = "\\*\\*(?=[^\\s*])([^\\n]*?[^\\s*])\\*\\*";

export type BoldRange = {
  /** Index of the opening stars. */
  start: number;
  /** Index just past the closing stars. */
  end: number;
};

export function boldRanges(text: string): BoldRange[] {
  const re = new RegExp(BOLD_SOURCE, "g");
  const out: BoldRange[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Text split into plain and bold runs, with the stars removed. */
export function splitBoldRuns(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  let last = 0;
  for (const r of boldRanges(text)) {
    if (r.start > last) out.push({ text: text.slice(last, r.start), bold: false });
    out.push({ text: text.slice(r.start + 2, r.end - 2), bold: true });
    last = r.end;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}

/**
 * Bold button / Cmd+B. Wraps the selection in `**`, or unwraps it when it is
 * already bold. With no selection it inserts `****` with the caret inside, or
 * removes that empty pair if the caret is sitting in one.
 */
export function toggleBoldAt(
  text: string,
  start: number,
  end: number
): { text: string; start: number; end: number } {
  const selected = text.slice(start, end);
  // Keep surrounding spaces outside the stars so `** word**` never happens.
  const s = start + (selected.length - selected.trimStart().length);
  const e = Math.max(s, end - (selected.length - selected.trimEnd().length));
  const inner = text.slice(s, e);

  if (s >= 2 && text.slice(s - 2, s) === "**" && text.slice(e, e + 2) === "**") {
    return {
      text: text.slice(0, s - 2) + inner + text.slice(e + 2),
      start: s - 2,
      end: e - 2,
    };
  }
  if (inner.length >= 4 && inner.startsWith("**") && inner.endsWith("**")) {
    const unwrapped = inner.slice(2, -2);
    return {
      text: text.slice(0, s) + unwrapped + text.slice(e),
      start: s,
      end: s + unwrapped.length,
    };
  }
  return {
    text: `${text.slice(0, s)}**${inner}**${text.slice(e)}`,
    start: s + 2,
    end: e + 2,
  };
}
