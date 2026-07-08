import { useEffect } from "react";

/**
 * Embed support for external iframes (Boss Score funnel, membership page, etc.).
 *
 * Adding `?embed=1` switches the page into embed mode: full-viewport sizing is
 * dropped so the content flows naturally, and the page posts its height to the
 * host window so the iframe can auto-resize (no inner scrollbars).
 */

export const EMBED_RESIZE_MESSAGE_TYPE = "boss-score-embed:resize";

const EMBED_TRUTHY = new Set(["1", "true", "yes", "embed"]);

type SearchParamsLike = { get: (key: string) => string | null };

export function isEmbedParam(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMBED_TRUTHY.has(value.trim().toLowerCase());
}

/** True when the page is requested in embed mode (`?embed=1`). */
export function isEmbeddedRequest(searchParams: SearchParamsLike): boolean {
  return isEmbedParam(searchParams.get("embed"));
}

function measureDocumentHeight(): number {
  const doc = document.documentElement;
  const body = document.body;
  return Math.max(
    body.scrollHeight,
    body.offsetHeight,
    doc.scrollHeight,
    doc.offsetHeight
  );
}

/**
 * While embedded inside an iframe, continuously posts the document height to
 * the parent window so the host page can resize the iframe to fit. No-op when
 * not embedded or when not actually framed.
 */
export function useEmbedAutoResize(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (window.parent === window) return;

    let lastHeight = -1;
    function postHeight() {
      const height = measureDocumentHeight();
      if (height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage(
        { type: EMBED_RESIZE_MESSAGE_TYPE, height },
        "*"
      );
    }

    document.documentElement.classList.add("pc-embed");
    document.body.classList.add("pc-embed");

    postHeight();
    // Burst updates while layout settles (fonts, images, async data).
    const burst = window.setInterval(postHeight, 150);
    window.setTimeout(() => window.clearInterval(burst), 4000);

    const observer = new ResizeObserver(() => postHeight());
    observer.observe(document.body);
    window.addEventListener("load", postHeight);
    // Fallback for height changes that ResizeObserver can miss (fonts, async).
    const interval = window.setInterval(postHeight, 1000);

    return () => {
      document.documentElement.classList.remove("pc-embed");
      document.body.classList.remove("pc-embed");
      observer.disconnect();
      window.removeEventListener("load", postHeight);
      window.clearInterval(interval);
    };
  }, [enabled]);
}

/** Navigate the top-level browsing context (breaks out of an iframe). */
export function navigateTopWindow(url: string): void {
  if (typeof window === "undefined") return;
  if (window.parent !== window) {
    window.top!.location.assign(url);
    return;
  }
  window.location.assign(url);
}

/**
 * While embedded, route link clicks to the parent page so navigation does not
 * stay trapped inside the iframe. In-page hash links and target="_blank" are
 * left alone.
 */
export function useEmbedTopNavigation(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (window.parent === window) return;

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target === "_blank") return;

      event.preventDefault();
      event.stopPropagation();
      navigateTopWindow(anchor.href);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled]);
}

/**
 * Builds a copy-paste iframe snippet (with the matching auto-resize listener)
 * for embedding a Boss Score page on an external site.
 */
export const MEMBERSHIP_EMBED_PATH = "/membership?embed=1";

/** Copy-paste iframe snippet for the public membership page (e.g. Go High Level). */
export function buildMembershipEmbedSnippet(
  baseUrl = "https://www.theprofitcoach.com",
  minHeight = 4500
): string {
  const origin = baseUrl.replace(/\/$/, "");
  return buildEmbedSnippet(
    `${origin}${MEMBERSHIP_EMBED_PATH}`,
    "Profit Coach Membership",
    "profit-coach-membership",
    minHeight
  );
}

export function buildEmbedSnippet(
  src: string,
  title: string,
  frameId: string,
  minHeight = 1200
): string {
  const scriptOrigin = src.match(/^https?:\/\/[^/]+/)?.[0] ?? "https://www.theprofitcoach.com";
  return `<iframe
  src="${src}"
  title="${title}"
  id="${frameId}"
  scrolling="no"
  loading="lazy"
  style="width:100%;border:0;overflow:hidden;display:block;min-height:${minHeight}px;height:${minHeight}px;"
></iframe>
<script src="${scriptOrigin}/js/embed-resize.js" type="text/javascript"></script>`;
}
