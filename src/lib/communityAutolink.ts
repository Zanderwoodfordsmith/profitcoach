/** Same styling as external links in `CommunityPostMarkdownBody`. */
export const COMMUNITY_EXTERNAL_LINK_CLASS =
  "font-medium !text-blue-600 underline underline-offset-2 decoration-blue-600/40 hover:!text-blue-500 hover:decoration-blue-500";

export type TextAutolinkSegment =
  | { type: "text"; text: string }
  | { type: "url"; href: string; label: string };

const HTTP_URL_REGEX = /\b(https?:\/\/[^\s<>"']+)/gi;

function trimDisplayUrl(s: string): string {
  let out = s;
  for (let guard = 0; guard < 64; guard++) {
    const prev = out;
    while (/[.,;:!?]+$/.test(out)) {
      out = out.replace(/[.,;:!?]+$/, "");
    }
    if (out.endsWith(")")) {
      const inner = out.slice(0, -1);
      const opens = inner.split("(").length - 1;
      const closes = inner.split(")").length - 1;
      if (closes >= opens) {
        out = inner;
        continue;
      }
    }
    if (out === prev) break;
  }
  return out;
}

function tryParseHttpUrl(rawFromRegex: string): { href: string; display: string } | null {
  const display = trimDisplayUrl(rawFromRegex);
  if (!display) return null;
  try {
    const u = new URL(display);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return { href: u.href, display };
  } catch {
    return null;
  }
}

/** http(s), mailto and tel only; anything else (javascript:, mention:, …) is not a link. */
export function safeExternalHref(url: string): string | null {
  try {
    const u = new URL(url);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

const MARKDOWN_LINK_REGEX = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/**
 * `splitTextWithHttpUrls` plus `[label](url)` links (the comment link button
 * writes these). A link with an unsafe URL stays as literal text.
 */
export function splitTextWithLinks(text: string): TextAutolinkSegment[] {
  const re = new RegExp(MARKDOWN_LINK_REGEX.source, "g");
  const out: TextAutolinkSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const href = safeExternalHref(m[2] ?? "");
    if (!href) continue;
    if (m.index > last) out.push(...splitTextWithHttpUrls(text.slice(last, m.index)));
    out.push({ type: "url", href, label: m[1] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...splitTextWithHttpUrls(text.slice(last)));
  return out;
}

/** Split plain text into literal spans and http(s) URLs (for comment / preview bodies). */
export function splitTextWithHttpUrls(text: string): TextAutolinkSegment[] {
  const re = new RegExp(HTTP_URL_REGEX.source, "gi");
  const out: TextAutolinkSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", text: text.slice(last, m.index) });
    }
    const raw = m[0];
    const parsed = tryParseHttpUrl(raw);
    if (parsed) {
      out.push({ type: "url", href: parsed.href, label: parsed.display });
    } else {
      out.push({ type: "text", text: raw });
    }
    last = m.index + raw.length;
  }
  if (last < text.length) {
    out.push({ type: "text", text: text.slice(last) });
  }
  return out;
}
