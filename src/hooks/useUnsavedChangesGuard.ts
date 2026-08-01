"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PendingLeave =
  | { kind: "href"; href: string }
  | { kind: "action"; action: () => void };

/**
 * Warns before leaving a dirty form: browser close/refresh, in-app links to
 * another path, and explicit leave actions (e.g. Cancel).
 *
 * Same-path query changes (lesson `?tab=`) are allowed so tab switching still
 * works while editing.
 */
export function useUnsavedChangesGuard(enabled: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const bypassRef = useRef(false);

  const dialogOpen = enabled && pending !== null;

  const stay = useCallback(() => {
    setPending(null);
  }, []);

  const leave = useCallback(() => {
    if (!pending) return;
    const next = pending;
    setPending(null);
    bypassRef.current = true;
    if (next.kind === "href") {
      router.push(next.href);
    } else {
      next.action();
    }
    // Re-arm after the navigation / state update has a chance to settle.
    queueMicrotask(() => {
      bypassRef.current = false;
    });
  }, [pending, router]);

  /** Call instead of discarding immediately — prompts when `enabled`. */
  const requestLeave = useCallback(
    (action: () => void) => {
      if (!enabled || bypassRef.current) {
        action();
        return;
      }
      setPending({ kind: "action", action });
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (bypassRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    function onDocumentClick(e: MouseEvent) {
      if (bypassRef.current) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.(
        "a[href]"
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      // Tab / query changes on the same lesson page are fine.
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      setPending({
        kind: "href",
        href: `${url.pathname}${url.search}${url.hash}`,
      });
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [enabled]);

  return {
    dialogOpen,
    stay,
    leave,
    requestLeave,
  };
}
