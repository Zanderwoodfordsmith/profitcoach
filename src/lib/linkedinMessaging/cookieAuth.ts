/**
 * Turn Cookie-Editor JSON / cookie header into Voyager auth bits.
 * Needs li_at + JSESSIONID (csrf-token = JSESSIONID value without quotes).
 */

export type LinkedInCookieAuth = {
  cookieHeader: string;
  csrfToken: string;
  liAt: string;
  userAgent: string | null;
};

type CookieItem = {
  name?: string;
  value?: string;
};

function stripQuotes(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseCookieMap(raw: string): Map<string, string> {
  const trimmed = raw.trim();
  const map = new Map<string, string>();

  if (trimmed.startsWith("[")) {
    const items = JSON.parse(trimmed) as CookieItem[];
    if (!Array.isArray(items)) {
      throw new Error("Cookie JSON must be an array.");
    }
    for (const item of items) {
      if (!item?.name || item.value == null || item.value === "") continue;
      map.set(String(item.name), stripQuotes(String(item.value)));
    }
    return map;
  }

  if (trimmed.startsWith("{") && trimmed.includes("li_at")) {
    // Rare single-object export
    try {
      const obj = JSON.parse(trimmed) as CookieItem | Record<string, string>;
      if ("name" in obj && "value" in obj && obj.name) {
        map.set(String(obj.name), stripQuotes(String(obj.value)));
        return map;
      }
    } catch {
      // fall through to header parse
    }
  }

  for (const part of trimmed.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = stripQuotes(part.slice(idx + 1));
    if (name) map.set(name, value);
  }
  return map;
}

export function parseLinkedInCookieAuth(
  cookieRaw: string,
  userAgent?: string | null
): LinkedInCookieAuth {
  const map = parseCookieMap(cookieRaw);
  const liAt = map.get("li_at");
  if (!liAt) {
    throw new Error("Cookie payload is missing li_at.");
  }

  let jsession = map.get("JSESSIONID") || map.get("jsessionid") || "";
  jsession = stripQuotes(jsession);
  if (!jsession) {
    throw new Error(
      "Cookie payload is missing JSESSIONID (needed for csrf-token). Re-export cookies from linkedin.com while logged in (Cookie-Editor → Export as JSON)."
    );
  }
  // Header csrf-token is the JSESSIONID value, usually ajax:…
  const csrfToken = jsession.startsWith("ajax:")
    ? jsession
    : jsession.includes("ajax:")
      ? jsession
      : jsession;

  const pairs: string[] = [];
  for (const [name, value] of map) {
    // JSESSIONID is often sent quoted
    if (name === "JSESSIONID" || name === "jsessionid") {
      pairs.push(`JSESSIONID="${value}"`);
    } else {
      pairs.push(`${name}=${value}`);
    }
  }

  return {
    cookieHeader: pairs.join("; "),
    csrfToken,
    liAt,
    userAgent: userAgent?.trim() || null,
  };
}

export function voyagerHeaders(auth: LinkedInCookieAuth): HeadersInit {
  return {
    Accept: "application/vnd.linkedin.normalized+json+2.1",
    "csrf-token": auth.csrfToken,
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "en_US",
    "x-li-track": JSON.stringify({
      clientVersion: "1.13.18524",
      mpVersion: "1.13.18524",
      osName: "web",
      timezoneOffset: new Date().getTimezoneOffset() / -60,
      deviceFormFactor: "DESKTOP",
      mpName: "voyager-web",
    }),
    "User-Agent":
      auth.userAgent ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Cookie: auth.cookieHeader,
    Referer: "https://www.linkedin.com/messaging/",
    "Accept-Language": "en-US,en;q=0.9",
  };
}
