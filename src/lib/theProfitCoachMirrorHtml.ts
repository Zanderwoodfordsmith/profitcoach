import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const mirrorDir = path.join(process.cwd(), "public", "theprofitcoach-mirror");

const LEGACY_HOST_PREFIXES = [
  "https://www.theprofitcoach.com",
  "http://www.theprofitcoach.com",
  "https://theprofitcoach.com",
  "http://theprofitcoach.com",
] as const;

function normalizeFunnelBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/\/+$/, "");
  return t.length ? t : null;
}

function funnelBaseUrlFromEnv(): string | null {
  return normalizeFunnelBaseUrl(process.env.PROFIT_COACH_FUNNEL_BASE_URL);
}

function funnelIframeMode(): boolean {
  const v = process.env.PROFIT_COACH_FUNNEL_IFRAME?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function rewriteTheProfitCoachFunnelLinks(html: string, funnelBaseUrl: string): string {
  const base = funnelBaseUrl.replace(/\/+$/, "");
  let out = html;
  for (const prefix of LEGACY_HOST_PREFIXES) {
    out = out.split(prefix).join(base);
  }
  return out;
}

function iframeShellHtml(src: string, title: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe src="${esc}" title="${title.replace(/"/g, "&quot;")}" allow="clipboard-write; fullscreen" loading="eager"></iframe></body></html>`;
}

const mirrorFileMeta = {
  "home.html": { iframePath: "/home", title: "How it works" },
  "client-results.html": { iframePath: "/client-results", title: "Client results" },
} as const;

export async function theProfitCoachMirrorResponse(file: keyof typeof mirrorFileMeta) {
  const base = funnelBaseUrlFromEnv();
  const iframe = funnelIframeMode();

  if (iframe) {
    if (!base) {
      return new NextResponse(
        "Configure PROFIT_COACH_FUNNEL_BASE_URL (e.g. https://funnel.yourdomain.com) when PROFIT_COACH_FUNNEL_IFRAME is enabled.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    const { iframePath, title } = mirrorFileMeta[file];
    const src = `${base}${iframePath}`;
    const html = iframeShellHtml(src, title);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=120, s-maxage=300",
      },
    });
  }

  let html = await readFile(path.join(mirrorDir, file), "utf8");
  if (base) {
    html = rewriteTheProfitCoachFunnelLinks(html, base);
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
