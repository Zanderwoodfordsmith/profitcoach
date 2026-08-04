"use client";

import { Settings } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  coachClientsTabActive,
  coachClientsTabItems,
  getClientsTabItems,
  navLinkActive,
} from "@/components/layout/dashboardNavItems";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";

export type CoachToolsHub = "get-clients" | "coach-clients";

type Props = {
  hub: CoachToolsHub;
  /** When set, coaching tool tabs deep-link to this client’s workspace. */
  contactId?: string | null;
};

function CoachClientsTabsNav({
  pathname,
  search,
  contactId,
}: {
  pathname: string;
  search: string;
  contactId?: string | null;
}) {
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const items = coachClientsTabItems(prefix, { contactId });
  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Coach Clients tools"
      items={items.map((item) => ({
        kind: "link" as const,
        href: item.href,
        label: item.label,
        active: coachClientsTabActive(pathname, search, item.key),
        scroll: false,
      }))}
    />
  );
}

function CoachToolsHubTabsInner({ hub, contactId }: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  if (hub === "get-clients") {
    const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
    const items = getClientsTabItems(prefix);
    return (
      <PageHeaderUnderlineTabs
        ariaLabel="Get Clients tools"
        items={items.map((item) => {
          const iconOnly = "iconOnly" in item && item.iconOnly;
          return {
            kind: "link" as const,
            href: item.href,
            label: iconOnly ? (
              <span
                className="inline-flex items-center"
                title={item.label}
                aria-label={item.label}
              >
                <Settings className="h-4 w-4" aria-hidden />
                <span className="sr-only">{item.label}</span>
              </span>
            ) : (
              item.label
            ),
            active: navLinkActive(pathname, item.href),
            scroll: false,
          };
        })}
      />
    );
  }

  return (
    <CoachClientsTabsNav
      pathname={pathname}
      search={search}
      contactId={contactId}
    />
  );
}

/**
 * Underline tabs for the Tools hubs (Get Clients / Coach Clients).
 * Works for both /coach and /admin — former Marketing and Delivery links live here.
 */
export function CoachToolsHubTabs(props: Props) {
  const pathname = usePathname() ?? "";

  // Coach Clients: never flash an empty nav — Suspense fallback still lists every tab.
  if (props.hub === "coach-clients") {
    return (
      <Suspense
        fallback={
          <CoachClientsTabsNav
            pathname={pathname}
            search=""
            contactId={props.contactId}
          />
        }
      >
        <CoachToolsHubTabsInner {...props} />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <nav
          className="flex flex-wrap items-end justify-start gap-x-4 gap-y-1"
          aria-label="Get Clients tools"
        />
      }
    >
      <CoachToolsHubTabsInner {...props} />
    </Suspense>
  );
}
