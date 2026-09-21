/**
 * Unipile URL-search cursors are base64 JSON:
 * `{ account_id, limit, start, url }`.
 * A limit=1 probe (or a missing cursor) used to freeze imports at ~10 people.
 */

export type UnipileUrlSearchCursor = {
  account_id: string;
  limit: number;
  start: number;
  url: string;
};

export function decodeUnipileSearchCursor(
  raw: string
): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const json = JSON.parse(
      Buffer.from(trimmed, "base64").toString("utf8")
    ) as unknown;
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function encodeUnipileUrlSearchCursor(
  cursor: UnipileUrlSearchCursor
): string {
  return Buffer.from(
    JSON.stringify({
      account_id: cursor.account_id,
      limit: cursor.limit,
      start: cursor.start,
      url: cursor.url,
    }),
    "utf8"
  ).toString("base64");
}

function encodeCursorPayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/** Drop Sales Nav session junk that can pin Unipile to a tiny first page. */
export function salesNavUrlForUnipile(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sessionId");
    parsed.searchParams.delete("sessionid");
    parsed.searchParams.delete("viewAllFilters");
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Next page for a URL search. Always uses `start` + `limit` so we do not
 * inherit a probe’s limit=1, and so a missing Unipile cursor still pages.
 */
export function nextUnipileUrlSearchCursor(opts: {
  accountId: string;
  url: string;
  start: number;
  limit: number;
  providerCursor?: string | null;
}): string {
  const url = salesNavUrlForUnipile(opts.url);
  const start = Math.max(0, Math.floor(opts.start));
  const limit = Math.max(1, Math.min(100, Math.floor(opts.limit)));
  const decoded = opts.providerCursor
    ? decodeUnipileSearchCursor(opts.providerCursor)
    : null;
  if (decoded) {
    const decodedStart =
      typeof decoded.start === "number" && Number.isFinite(decoded.start)
        ? Math.floor(decoded.start)
        : 0;
    return encodeCursorPayload({
      ...decoded,
      account_id:
        typeof decoded.account_id === "string" && decoded.account_id.trim()
          ? decoded.account_id
          : opts.accountId,
      limit,
      start: Math.max(start, decodedStart),
    });
  }
  return encodeUnipileUrlSearchCursor({
    account_id: opts.accountId,
    limit,
    start,
    url,
  });
}
