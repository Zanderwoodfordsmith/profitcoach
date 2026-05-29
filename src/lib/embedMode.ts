import { useEffect } from "react";

/**
 * Embed support for the Boss Score funnel.
 *
 * Coaches can embed the opt-in landing (`/score/{slug}`) and the assessment
 * (`/assessment/{slug}`) on their own website via an <iframe>. Adding
 * `?embed=1` switches the page into embed mode: full-viewport sizing is
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

    postHeight();

    const observer = new ResizeObserver(() => postHeight());
    observer.observe(document.body);
    window.addEventListener("load", postHeight);
    // Fallback for height changes that ResizeObserver can miss (fonts, async).
    const interval = window.setInterval(postHeight, 1000);

    return () => {
      observer.disconnect();
      window.removeEventListener("load", postHeight);
      window.clearInterval(interval);
    };
  }, [enabled]);
}

/**
 * Builds a copy-paste iframe snippet (with the matching auto-resize listener)
 * for embedding a Boss Score page on an external site.
 */
export function buildEmbedSnippet(
  src: string,
  title: string,
  frameId: string,
  minHeight = 1200
): string {
  return `<iframe
  src="${src}"
  title="${title}"
  id="${frameId}"
  loading="lazy"
  style="width:100%;border:0;min-height:${minHeight}px;"
></iframe>
<script>
  (function () {
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (d && d.type === "${EMBED_RESIZE_MESSAGE_TYPE}") {
        var f = document.getElementById("${frameId}");
        if (f && d.height) { f.style.height = d.height + "px"; }
      }
    });
  })();
</script>`;
}
