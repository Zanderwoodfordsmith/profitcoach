/**
 * Campaign emails are written as plain text (blank line = new paragraph).
 * Gmail and Outlook read the body as HTML, so plain text arrives as one
 * squashed block with bare links (Hilary, 12 Nov). This turns it into a
 * simple, clean email: paragraphs, line breaks, lists, clickable links, and
 * a "Book ..." line becomes a button with the pointing hand.
 */

const URL_RE = /https?:\/\/[^\s<>"')]+/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trailing full stops or commas belong to the sentence, not the link. */
function splitTrailing(url: string): [string, string] {
  const m = url.match(/^(.*?)([.,;:!?]+)$/);
  return m ? [m[1], m[2]] : [url, ""];
}

const LINK_STYLE = "color:#0c5290;text-decoration:underline;";
const BUTTON_STYLE =
  "display:inline-block;background:#0c5290;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;";
const P_STYLE = "margin:0 0 16px;";

function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="${LINK_STYLE}">${label}</a>`;
}

/** Escape a line, mark **bold**, and make links clickable ("here: URL" becomes a "here" link). */
function inline(text: string): string {
  let out = "";
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const index = match.index ?? 0;
    const [url, trailing] = splitTrailing(match[0]);
    let before = text.slice(last, index);
    let label = escapeHtml(url);
    // "...any time here: https://..." reads as "...any time here" with "here" linked.
    // "... Book your Constraint Call: https://..." mid-sentence reads as a "👉 Book your Constraint Call" link.
    const named = before.match(/\b(here|this link)\s*:\s*$/i);
    const book = before.match(/(?:👉\s*)?\b(Book [^:.!?\n]{2,60}?)\s*:\s*$/iu);
    if (named) {
      label = escapeHtml(named[1]);
      before = before.slice(0, before.length - named[0].length);
    } else if (book) {
      label = `👉 ${escapeHtml(book[1])}`;
      before = before.slice(0, before.length - book[0].length);
    }
    out += escapeHtml(before) + link(url, label) + escapeHtml(trailing);
    last = index + match[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** "Book your Constraint Call: https://..." on its own line → a button. Other "Label: URL" lines → a named link. */
function labelledLinkLine(line: string): string | null {
  const m = line.trim().match(/^(👉\s*)?([^:\n]{2,80}?):\s*(https?:\/\/\S+)$/u);
  if (!m) return null;
  const pointer = m[1] ? "👉 " : "";
  const label = m[2].trim();
  const [href] = splitTrailing(m[3]);
  if (/^book\b/i.test(label)) {
    return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="${BUTTON_STYLE}">👉 ${escapeHtml(label)}</a></p>`;
  }
  return `<p style="${P_STYLE}">${pointer}${link(href, `<strong>${escapeHtml(label)}</strong>`)}</p>`;
}

function paragraph(block: string): string {
  const lines = block.split("\n").map((l) => l.trimEnd());
  if (lines.length === 1) {
    const asLink = labelledLinkLine(lines[0]);
    if (asLink) return asLink;
    // A line that is all bold is a small section heading ("**Level 1: Overwhelmed**").
    const heading = lines[0].trim().match(/^\*\*([^*]+)\*\*$/);
    if (heading) {
      return `<p style="margin:24px 0 6px;font-size:16px;font-weight:700;color:#0c5290;">${escapeHtml(heading[1])}</p>`;
    }
  }
  if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
    const items = lines.map((l) => `<li style="margin:0 0 6px;">${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`);
    return `<ul style="margin:0 0 16px;padding-left:22px;">${items.join("")}</ul>`;
  }
  if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
    const items = lines.map((l) => `<li style="margin:0 0 6px;">${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
    return `<ol style="margin:0 0 16px;padding-left:22px;">${items.join("")}</ol>`;
  }
  return `<p style="${P_STYLE}">${lines.map((l) => labelledLinkLine(l)?.replace(/^<p[^>]*>|<\/p>$/g, "") ?? inline(l)).join("<br>")}</p>`;
}

export function plainEmailToHtml(text: string): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  // Already HTML (an email written in a rich editor): send as it is.
  if (/<(p|br|div|a|table)\b[^>]*>/i.test(trimmed)) return trimmed;
  const blocks = trimmed.split(/\n{2,}/).filter((b) => b.trim());
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;">${blocks
    .map(paragraph)
    .join("")}</div>`;
}
