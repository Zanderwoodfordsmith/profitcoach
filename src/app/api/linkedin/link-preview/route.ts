import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";

export const maxDuration = 30;

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "0.0.0.0" || h === "::" || h === "::1") return true;
  // Block obvious private/literal IPs
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function metaContent(html: string, property: string): string | null {
  const propRe = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  const m = html.match(propRe) || html.match(contentFirst);
  if (!m?.[1]) return null;
  return m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() || null;
}

function absoluteUrl(base: string, maybeRelative: string | null): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

/**
 * Fetch Open Graph / basic meta for a public URL so the composer can set
 * LinkedIn article title/description (API does not scrape).
 */
export async function POST(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const raw = body.url?.trim() || "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "URL must be http or https." }, { status: 400 });
  }
  if (isPrivateHostname(parsed.hostname)) {
    return NextResponse.json({ error: "That host is not allowed." }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "ProfitCoachLinkPreview/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch link (${res.status}).` },
        { status: 502 }
      );
    }
    const finalUrl = res.url || parsed.toString();
    const html = (await res.text()).slice(0, 500_000);
    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      titleTag(html) ||
      parsed.hostname;
    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description") ||
      metaContent(html, "description") ||
      "";
    const image = absoluteUrl(
      finalUrl,
      metaContent(html, "og:image") || metaContent(html, "twitter:image")
    );

    return NextResponse.json({
      ok: true,
      preview: {
        url: finalUrl,
        title: title.slice(0, 200),
        description: description.slice(0, 300),
        image,
        domain: new URL(finalUrl).hostname.replace(/^www\./, ""),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    return NextResponse.json({ error: `Could not preview link: ${message}` }, { status: 502 });
  }
}
