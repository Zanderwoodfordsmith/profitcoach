"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Pathname that updates on click, before the destination page is ready.
 * Clears when Next.js finishes the navigation.
 */
export function useOptimisticPathname() {
  const livePathname = usePathname() ?? "";
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [livePathname]);

  const markPending = useCallback(
    (href: string) => {
      const path = href.split("?")[0] ?? href;
      if (path && path !== livePathname) {
        setPendingHref(path);
      }
    },
    [livePathname],
  );

  return {
    pathname: pendingHref ?? livePathname,
    livePathname,
    markPending,
  };
}
