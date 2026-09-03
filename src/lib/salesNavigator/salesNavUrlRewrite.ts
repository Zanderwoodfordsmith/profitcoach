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

/** Remove one encoded filter block by type (e.g. COMPANY_HEADCOUNT). */
function removeFilterType(encodedQuery: string, type: string): string {
  const marker = `type%3A${type}%2C`;
  let out = encodedQuery;
  for (;;) {
    const idx = out.indexOf(marker);
    if (idx === -1) break;
    let start = idx;
    while (start > 0 && out[start - 1] !== "(") start -= 1;
    if (start > 0) start -= 1;
    let depth = 0;
    let end = start;
    for (; end < out.length; end++) {
      if (out[end] === "(") depth += 1;
      if (out[end] === ")") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    if (end < out.length && out[end] === ",") {
      out = out.slice(0, start) + out.slice(end + 1);
    } else if (start > 0 && out[start - 1] === ",") {
      out = out.slice(0, start - 1) + out.slice(end);
    } else {
      out = out.slice(0, start) + out.slice(end);
    }
  }
  return out;
}

function insertFilter(encodedQuery: string, filter: string): string {
  const listMarker = "filters%3AList(";
  const idx = encodedQuery.indexOf(listMarker);
  if (idx === -1) {
    throw new Error("Could not locate filters list in Sales Nav URL.");
  }
  const insertAt = idx + listMarker.length;
  const prefix = encodedQuery.slice(0, insertAt);
  const suffix = encodedQuery.slice(insertAt);
  if (suffix.startsWith(")")) {
    return `${prefix}${filter}${suffix}`;
  }
  return `${prefix}${filter}%2C${suffix}`;
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
  const without = removeFilterType(query, "COMPANY_HEADCOUNT");
  const filter = headcountFilterEncoded(bands);
  return rebuildSalesNavUrl(salesNavUrl, insertFilter(without, filter));
}

export function rewriteSalesNavUrlYearsAtCompany(
  salesNavUrl: string,
  yearsIds: SalesNavYearsAtCompanyId[]
): string {
  if (yearsIds.length === 0) return salesNavUrl;
  const query = extractQueryParam(salesNavUrl);
  if (!query) throw new Error("Sales Nav URL is missing query.");
  const without = removeFilterType(query, "YEARS_AT_CURRENT_COMPANY");
  const filter = yearsBucketFilterEncoded("YEARS_AT_CURRENT_COMPANY", yearsIds);
  return rebuildSalesNavUrl(salesNavUrl, insertFilter(without, filter));
}

/** LinkedIn SN "Years in current position" — same 1–5 bucket ids as company tenure. */
export function rewriteSalesNavUrlYearsAtPosition(
  salesNavUrl: string,
  yearsIds: SalesNavYearsAtCompanyId[]
): string {
  if (yearsIds.length === 0) return salesNavUrl;
  const query = extractQueryParam(salesNavUrl);
  if (!query) throw new Error("Sales Nav URL is missing query.");
  const without = removeFilterType(query, "YEARS_AT_CURRENT_POSITION");
  const filter = yearsBucketFilterEncoded("YEARS_AT_CURRENT_POSITION", yearsIds);
  return rebuildSalesNavUrl(salesNavUrl, insertFilter(without, filter));
}

export function queryBlobFromSalesNavUrl(salesNavUrl: string): string {
  return decodedQueryBlob(salesNavUrl);
}
