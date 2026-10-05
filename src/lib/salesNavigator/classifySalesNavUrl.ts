/**
 * What a pasted Sales Navigator link actually is.
 * Saved and recent people searches omit `query` — the filters live on LinkedIn
 * under an id. Query searches are the ones we can split by company size.
 */

import { hasRewriteableSalesNavQuery } from "@/lib/salesNavigator/salesNavUrlRewrite";

export type SalesNavUrlRejection =
  | "company"
  | "lead_list"
  | "account_list"
  | "no_filters"
  | "other_sales"
  | "not_sales_nav";

export type ClassifiedSalesNavUrl =
  | { kind: "query"; url: string }
  | { kind: "saved_people"; url: string; id: string }
  | { kind: "recent_people"; url: string; id: string }
  | { kind: "passthrough"; url: string }
  | {
      kind: "rejected";
      url: string;
      reason: SalesNavUrlRejection;
      message: string;
      /** Ask the coach to send the link to support. */
      support: boolean;
    };

const SUPPORT_TAIL =
  " Open a support ticket and paste the link so we can add it.";

function rejected(
  url: string,
  reason: SalesNavUrlRejection,
  message: string,
  support: boolean
): ClassifiedSalesNavUrl {
  return {
    kind: "rejected",
    url,
    reason,
    message: support ? `${message}${SUPPORT_TAIL}` : message,
    support,
  };
}

function idParam(raw: string, name: string): string | null {
  const match = raw.match(
    new RegExp(`(?:^|[?&#])${name}=(\\d+)(?:$|[&#])`, "i")
  );
  return match?.[1] ?? null;
}

function normalizePaste(raw: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

export function classifySalesNavUrl(raw: string): ClassifiedSalesNavUrl {
  const url = normalizePaste(raw);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return rejected(
      url,
      "not_sales_nav",
      "Paste a Sales Navigator people-search URL (linkedin.com/sales/search/people…).",
      false
    );
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
    return rejected(
      url,
      "not_sales_nav",
      "Paste a Sales Navigator people-search URL (linkedin.com/sales/search/people…).",
      false
    );
  }

  const path = parsed.pathname.toLowerCase();
  const haystack = `${parsed.pathname}${parsed.search}${parsed.hash}`;

  if (path.includes("/sales/search/company")) {
    return rejected(
      url,
      "company",
      "That link is a Sales Navigator company search. Pool import needs a people search or a saved people search.",
      true
    );
  }
  if (/\/sales\/lists\/people(\/|$)/.test(path)) {
    return rejected(
      url,
      "lead_list",
      "That link is a Sales Navigator lead list. Pool import reads people searches and saved people searches, not lists yet.",
      true
    );
  }
  if (
    /\/sales\/lists\/(company|account)/.test(path) ||
    path.includes("/sales/accounts")
  ) {
    return rejected(
      url,
      "account_list",
      "That link is a Sales Navigator account list. Pool import needs a people search or a saved people search.",
      true
    );
  }

  if (!path.includes("/sales/search/people")) {
    return rejected(
      url,
      path.includes("/sales/") ? "other_sales" : "not_sales_nav",
      path.includes("/sales/")
        ? "That Sales Navigator link isn’t a people search we can import. Copy a people-search URL, or a saved people search."
        : "Paste a Sales Navigator people-search URL (linkedin.com/sales/search/people…).",
      path.includes("/sales/")
    );
  }

  if (hasRewriteableSalesNavQuery(url)) {
    return { kind: "query", url };
  }

  const savedId = idParam(haystack, "savedSearchId");
  if (savedId) return { kind: "saved_people", url, id: savedId };

  const recentId = idParam(haystack, "recentSearchId");
  if (recentId) return { kind: "recent_people", url, id: recentId };

  if (/[?&#]query=/i.test(haystack)) {
    return { kind: "passthrough", url };
  }

  return rejected(
    url,
    "no_filters",
    "That people-search link doesn’t include the filters. Open the results in Sales Navigator and copy the address bar — it should contain query= or savedSearchId=.",
    true
  );
}

export function salesNavUrlImports(url: string): boolean {
  const kind = classifySalesNavUrl(url).kind;
  return kind !== "rejected";
}

/** Shown when we import the link as one search instead of splitting by company size. */
export function salesNavSingleSearchNote(
  classified: ClassifiedSalesNavUrl
): string | null {
  if (classified.kind === "saved_people") {
    return "Saved people search. We import it with the filters you already saved. Sales Navigator only returns the first 2,500 people from one search — if it’s larger, narrow it there and paste again.";
  }
  if (classified.kind === "recent_people") {
    return "Recent search. We import it as one search. Sales Navigator only returns the first 2,500 people from one search.";
  }
  if (classified.kind === "passthrough") {
    return "We’ll import this link as one search. Sales Navigator only returns the first 2,500 people from one search.";
  }
  return null;
}

function withoutParams(url: string, names: string[]): string {
  const queryAt = url.indexOf("?");
  if (queryAt < 0) return url;
  const hashAt = url.indexOf("#", queryAt);
  const query = hashAt >= 0 ? url.slice(queryAt + 1, hashAt) : url.slice(queryAt + 1);
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const drop = new Set(names.map((name) => name.toLowerCase()));
  const kept = query.split("&").filter((part) => {
    const key = (part.split("=")[0] ?? "").toLowerCase();
    return part.length > 0 && !drop.has(key);
  });
  return `${url.slice(0, queryAt)}?${kept.join("&")}${hash}`;
}

export type PreparedSalesNavUrl = {
  url: string;
  classified: ClassifiedSalesNavUrl;
  /** Plain-language notes when the pasted link would open blank for this coach. */
  adjustments: string[];
};

/**
 * A copied Sales Nav link often carries the other person's session and saved
 * search. Those make the website show nobody. Keep the filter query when it
 * is there; otherwise keep a saved-search id the coach actually owns.
 */
export function prepareSalesNavImportUrl(raw: string): PreparedSalesNavUrl {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  const adjustments: string[] = [];
  let url = withoutParams(trimmed, ["sessionId", "sessionid"]);
  if (/[?&#]sessionId=/i.test(trimmed)) {
    adjustments.push(
      "Removed the session id. It belongs to the person who copied the link, and Sales Navigator shows an empty search for anyone else."
    );
  }
  let classified = classifySalesNavUrl(url);
  if (classified.kind === "query" && /[?&#]savedSearchId=\d+/i.test(url)) {
    url = withoutParams(url, ["savedSearchId"]);
    classified = classifySalesNavUrl(url);
    adjustments.push(
      "Removed the saved-search id and used the filters in the link. A saved search only opens on the account that saved it."
    );
  }
  if (classified.kind === "query" && /[?&#]recentSearchId=\d+/i.test(url)) {
    url = withoutParams(url, ["recentSearchId"]);
    classified = classifySalesNavUrl(url);
    adjustments.push(
      "Removed the recent-search id and used the filters in the link."
    );
  }
  return { url, classified, adjustments };
}

export class SalesNavImportRejectedError extends Error {
  readonly reason: string;
  readonly support: boolean;

  constructor(message: string, reason: string, support: boolean) {
    super(message);
    this.name = "SalesNavImportRejectedError";
    this.reason = reason;
    this.support = support;
  }
}
