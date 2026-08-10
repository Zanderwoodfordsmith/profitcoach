/**
 * Normalize Cookie-Editor JSON, stringified JSON, or "li_at=…; …" into Playwright cookies.
 */

export function parseLinkedInCookies(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    throw new Error("cookies input is empty.");
  }

  let items = null;
  if (trimmed.startsWith("[")) {
    items = JSON.parse(trimmed);
  } else if (trimmed.startsWith('"[')) {
    items = JSON.parse(JSON.parse(trimmed));
  }

  if (Array.isArray(items)) {
    const cookies = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const name = item.name;
      let value = item.value;
      if (!name || value == null || value === "") continue;
      value = String(value);
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      let domain = String(item.domain || ".linkedin.com");
      // Playwright wants domain like .linkedin.com or .www.linkedin.com
      if (!domain.startsWith(".")) domain = `.${domain}`;

      cookies.push({
        name: String(name),
        value,
        domain,
        path: item.path || "/",
        httpOnly: Boolean(item.httpOnly),
        secure: item.secure !== false,
        sameSite: mapSameSite(item.sameSite),
      });
    }
    if (!cookies.some((c) => c.name === "li_at")) {
      throw new Error("Cookie JSON is missing li_at.");
    }
    return cookies;
  }

  // Header-style: li_at=xxx; JSESSIONID="ajax:…"
  const cookies = [];
  for (const part of trimmed.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    let value = part.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!name) continue;
    cookies.push({
      name,
      value,
      domain: ".linkedin.com",
      path: "/",
      httpOnly: name === "li_at",
      secure: true,
      sameSite: "None",
    });
  }
  if (!cookies.some((c) => c.name === "li_at")) {
    throw new Error('Cookie string must include li_at=…');
  }
  return cookies;
}

function mapSameSite(value) {
  const v = String(value || "").toLowerCase();
  if (v === "strict") return "Strict";
  if (v === "lax") return "Lax";
  return "None";
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jitterDelayMs(baseSeconds) {
  const base = Math.max(2, Number(baseSeconds) || 8) * 1000;
  return base + Math.floor(Math.random() * base);
}
