"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getClientsTabItems,
  getClientsHubPaths,
  isToolsHubPath,
} from "@/components/layout/dashboardNavItems";
import {
  prefetchCallsHub,
  prefetchGetClientsHref,
} from "@/lib/getClients/hubFetchers";
import { rememberGetClientsLastTab } from "@/lib/getClients/lastHubTab";
import { getStoredImpersonatingCoachId } from "@/lib/coachAuthHeaders";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * When the Get Clients hub is open: prefetch sibling tab JS immediately,
 * then warm their list payloads after a short idle so the current tab wins
 * the network.
 */
export function GetClientsHubWarmup() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const inHub = isToolsHubPath(pathname, getClientsHubPaths(prefix));

  useEffect(() => {
    rememberGetClientsLastTab(pathname);
    if (!inHub) return;
    const items = getClientsTabItems(prefix);
    for (const item of items) {
      try {
        router.prefetch(item.href);
      } catch {
        /* prefetch is best-effort */
      }
    }

    const current = pathname.split("?")[0] ?? pathname;
    // Lead Lists, Campaigns and Lead Magnets share one path (?tab=…), so
    // compare the whole link: from Lead Lists, still warm Campaigns.
    const currentHref = `${current}${window.location.search}`;
    const idle = window.setTimeout(() => {
      for (const item of items) {
        if (item.href === currentHref) continue;
        prefetchGetClientsHref(item.href);
      }
      if (!current.endsWith("/calls")) {
        void supabaseClient.auth.getSession().then(({ data }) => {
          const userId = data.session?.user.id;
          if (!userId) return;
          prefetchCallsHub(
            prefix === "/admin",
            getStoredImpersonatingCoachId() || userId
          );
        });
      }
    }, 450);

    return () => window.clearTimeout(idle);
  }, [inHub, pathname, prefix, router]);

  return null;
}
