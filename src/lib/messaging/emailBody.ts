const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

/** Plain text from an email HTML body — good enough for inbox bubbles and previews. */
export function htmlEmailToText(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, name: string) => {
      const key = name.toLowerCase();
      if (ENTITIES[key]) return ENTITIES[key];
      if (key.startsWith("#x")) {
        const code = parseInt(key.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (key.startsWith("#")) {
        const code = parseInt(key.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Readable body for a Unipile email; empty when the payload carried no body (meta_only lists). */
export function unipileEmailBodyText(email: {
  body_plain?: unknown;
  body?: unknown;
}): string {
  const plain = typeof email.body_plain === "string" ? email.body_plain.trim() : "";
  if (plain) return plain;
  const html = typeof email.body === "string" ? email.body.trim() : "";
  return html ? htmlEmailToText(html) : "";
}

/** Stored row only has the subject (or nothing) where the body should be. */
export function isPlaceholderEmailBody(
  bodyText: string | null | undefined,
  subject: string | null | undefined
): boolean {
  const body = (bodyText || "").trim();
  if (!body) return true;
  const subj = (subject || "").trim();
  return Boolean(subj) && body === subj;
}

/** Full fetch already confirmed the provider has no body (calendar RSVPs). */
export function isResolvedEmailBody(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as { body_resolved?: unknown }).body_resolved === true;
}

/** Still need a Unipile body fetch. Confirmed-empty mail must not keep retrying. */
export function emailNeedsBodyFetch(input: {
  bodyText: string | null | undefined;
  subject: string | null | undefined;
  metadata?: unknown;
}): boolean {
  if (isResolvedEmailBody(input.metadata)) return false;
  return isPlaceholderEmailBody(input.bodyText, input.subject);
}
