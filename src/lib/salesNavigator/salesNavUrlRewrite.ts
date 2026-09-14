/**
 * Rewrite COMPANY_HEADCOUNT / YEARS_AT_CURRENT_COMPANY / YEARS_AT_CURRENT_POSITION
 * filters on pasted Sales Nav URLs.
 * Operates on the encoded query param as LinkedIn stores it (no full decode round-trip).
 */

import {
  YEARS_AT_CURRENT_COMPANY,
  type SalesNavYearsAtCompanyId,
} from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import {
  headcountBandForLabel,
  type SalesNavHeadcountBand,
} from "@/lib/salesNavigator/headcountBands";

function encText(text: string): string {
  return encodeURIComponent(encodeURIComponent(text));
}

/**
 * LinkedIn’s `query` value is percent-encoded (`type%3A`, `filters%3AList(`).
 * `URLSearchParams.get` decodes that, which breaks rewrite. Prefer the raw
 * query string when it still has encoded markers; otherwise take one decode
 * (typical copied Sales Nav URLs are double-encoded).
 */
function extractQueryParam(salesNavUrl: string): string {
  const raw = salesNavUrl.match(/[?&]query=([^&]*)/)?.[1] ?? "";
  let fromParams = "";
  try {
    fromParams = new URL(salesNavUrl).searchParams.get("query") ?? "";
  } catch {
    fromParams = "";
  }
  if (isRewriteEncodedQuery(raw)) return raw;
  if (isRewriteEncodedQuery(fromParams)) return fromParams;
  return raw || fromParams;
}

function isRewriteEncodedQuery(query: string): boolean {
  return (
    query.includes("filters%3AList(") ||
    query.includes("type%3A") ||
    query.includes("%2Cfilters%3AList(")
  );
}

function headcountFilterEncoded(bands: SalesNavHeadcountBand[]): string {
  const parts = bands.map(
    (b) =>
      `(id%3A${b.id}%2Ctext%3A${encodeURIComponent(b.label)}%2CselectionType%3AINCLUDED)`
  );
  return `(type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList(${parts.join("%2C")}))`;
}

function yearsBucketFilterEncoded(
  type: "YEARS_AT_CURRENT_COMPANY" | "YEARS_AT_CURRENT_POSITION",
  ids: SalesNavYearsAtCompanyId[]
): string {
  const parts = ids.map((id) => {
    const mapped = YEARS_AT_CURRENT_COMPANY[id];
    return `(id%3A${mapped.id}%2Ctext%3A${encText(mapped.text)}%2CselectionType%3AINCLUDED)`;
  });
  return `(type%3A${type}%2Cvalues%3AList(${parts.join("%2C")}))`;
}

/**
 * Bounds of one encoded `(type%3A…)` filter block, or null.
 * LinkedIn rejects some searches when filters are reordered — prefer in-place
 * replace over remove + insert-at-front.
 */
function findFilterBlock(
  encodedQuery: string,
  type: string
): { start: number; end: number } | null {
  const marker = `type%3A${type}%2C`;
  const idx = encodedQuery.indexOf(marker);
  if (idx === -1) return null;
  let start = idx;
  while (start > 0 && encodedQuery[start - 1] !== "(") start -= 1;
  if (start > 0) start -= 1;
  let depth = 0;
  let end = start;
  for (; end < encodedQuery.length; end++) {
    if (encodedQuery[end] === "(") depth += 1;
    if (encodedQuery[end] === ")") {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return { start, end };
}

/** Replace an existing filter in place, or append inside filters%3AList(…). */
function replaceOrAppendFilter(
  encodedQuery: string,
  type: string,
  filter: string
): string {
  const existing = findFilterBlock(encodedQuery, type);
  if (existing) {
    return (
      encodedQuery.slice(0, existing.start) +
      filter +
      encodedQuery.slice(existing.end)
    );
  }

  const listMarker = "filters%3AList(";
  const idx = encodedQuery.indexOf(listMarker);
  if (idx === -1) {
    throw new Error("Could not locate filters list in Sales Nav URL.");
  }
  const openParen = idx + listMarker.length - 1;
  let depth = 0;
  let close = openParen;
  for (; close < encodedQuery.length; close++) {
    if (encodedQuery[close] === "(") depth += 1;
    if (encodedQuery[close] === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (close >= encodedQuery.length) {
    throw new Error("Could not locate end of filters list in Sales Nav URL.");
  }
  const inner = encodedQuery.slice(openParen + 1, close);
  const nextInner = inner ? `${inner}%2C${filter}` : filter;
  return (
    encodedQuery.slice(0, openParen + 1) + nextInner + encodedQuery.slice(close)
  );
}

function rebuildSalesNavUrl(salesNavUrl: string, encodedQuery: string): string {
  const hashIndex = salesNavUrl.indexOf("#");
  const withoutHash =
    hashIndex >= 0 ? salesNavUrl.slice(0, hashIndex) : salesNavUrl;
  const hash = hashIndex >= 0 ? salesNavUrl.slice(hashIndex) : "";
  const qIndex = withoutHash.indexOf("?");
  const path =
    qIndex >= 0
      ? withoutHash.slice(0, qIndex)
      : withoutHash || "https://www.linkedin.com/sales/search/people";
  const search = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";
  const params = search
    .split("&")
    .filter((p) => p.length > 0 && !p.startsWith("query="));
  const next = [`query=${encodedQuery}`, ...params];
  if (!next.some((p) => p.startsWith("viewAllFilters="))) {
    next.push("viewAllFilters=true");
  }
  return `${path}?${next.join("&")}${hash}`;
}

function decodedQueryBlob(salesNavUrl: string): string {
  const q = extractQueryParam(salesNavUrl);
  let prev = q;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(prev);
      if (next === prev) break;
      prev = next;
    } catch {
      break;
    }
  }
  return prev;
}

export function hasFilterType(salesNavUrl: string, type: string): boolean {
  const blob = decodedQueryBlob(salesNavUrl);
  return blob.includes(`type:${type},`);
}

export function rewriteSalesNavUrlHeadcounts(
  salesNavUrl: string,
  teamSizeLabels: string[]
): string {
  const bands = teamSizeLabels
    .map((label) => headcountBandForLabel(label))
    .filter((b): b is SalesNavHeadcountBand => Boolean(b));
  if (bands.length === 0) {
    throw new Error("No valid team-size bands for URL rewrite.");
  }
  const query = extractQueryParam(salesNavUrl);
  if (!query) throw new Error("Sales Nav URL is missing query.");
  const filter = headcountFilterEncoded(bands);
  return rebuildSalesNavUrl(
    salesNavUrl,
    replaceOrAppendFilter(query, "COMPANY_HEADCOUNT", filter)
  );
}

export function rewriteSalesNavUrlYearsAtCompany(
  salesNavUrl: string,
  yearsIds: SalesNavYearsAtCompanyId[]
): string {
  if (yearsIds.length === 0) return salesNavUrl;
  const query = extractQueryParam(salesNavUrl);
  if (!query) throw new Error("Sales Nav URL is missing query.");
  const filter = yearsBucketFilterEncoded("YEARS_AT_CURRENT_COMPANY", yearsIds);
  return rebuildSalesNavUrl(
    salesNavUrl,
    replaceOrAppendFilter(query, "YEARS_AT_CURRENT_COMPANY", filter)
  );
}

/** LinkedIn SN "Years in current position" — same 1–5 bucket ids as company tenure. */
export function rewriteSalesNavUrlYearsAtPosition(
  salesNavUrl: string,
  yearsIds: SalesNavYearsAtCompanyId[]
): string {
  if (yearsIds.length === 0) return salesNavUrl;
  const query = extractQueryParam(salesNavUrl);
  if (!query) throw new Error("Sales Nav URL is missing query.");
  const filter = yearsBucketFilterEncoded("YEARS_AT_CURRENT_POSITION", yearsIds);
  return rebuildSalesNavUrl(
    salesNavUrl,
    replaceOrAppendFilter(query, "YEARS_AT_CURRENT_POSITION", filter)
  );
}

export function queryBlobFromSalesNavUrl(salesNavUrl: string): string {
  return decodedQueryBlob(salesNavUrl);
}
