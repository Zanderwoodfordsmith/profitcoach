"use client";

import { Lock, Settings } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  coachClientsTabActive,
  coachClientsTabItems,
  getClientsTabItems,
  navLinkActive,
  type CoachClientsTabItem,
  type ToolsHubTabItem,
} from "@/components/layout/dashboardNavItems";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { isLeadFinderAllowedEmail } from "@/lib/leadFinderAccess";
import { supabaseClient } from "@/lib/supabaseClient";

export type CoachToolsHub = "get-clients" | "coach-clients";

type Props = {
  hub: CoachToolsHub;
  /** When set, coaching tool tabs deep-link to this client’s workspace. */
  contactId?: string | null;
};

function previewTabLabel(label: ReactNode, adminPreview: boolean): ReactNode {
  if (!adminPreview) return label;
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">(admin preview — not released to coaches)</span>
    </span>
  );
}

function CoachClientsTabsNav({
  pathname,
  search,
  contactId,
  showAdminPreview,
}: {
  pathname: string;
  search: string;
  contactId?: string | null;
  showAdminPreview: boolean;
}) {
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const items = coachClientsTabItems(prefix, { contactId }).filter(
    (item: CoachClientsTabItem) => showAdminPreview || !item.adminPreview
  );
  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Coach Clients tools"
      items={items.map((item) => ({
        kind: "link" as const,
        href: item.href,
        label: previewTabLabel(item.label, Boolean(item.adminPreview)),
        active: coachClientsTabActive(pathname, search, item.key),
        scroll: false,
        variant: item.adminPreview ? ("subtle" as const) : ("default" as const),
      }))}
    />
  );
}

function CoachToolsHubTabsInner({ hub, contactId }: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const onAdminPath = pathname.startsWith("/admin");
  const [leadFinderAllowed, setLeadFinderAllowed] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(onAdminPath);

  useEffect(() => {
    if (onAdminPath) {
      setIsAdminUser(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (!cancelled) {
        setIsAdminUser(roleBody.role === "admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onAdminPath]);

  useEffect(() => {
    if (hub !== "get-clients" || !onAdminPath) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!cancelled) {
        setLeadFinderAllowed(isLeadFinderAllowedEmail(user?.email));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hub, onAdminPath]);

  if (hub === "get-clients") {
    const prefix = onAdminPath ? "/admin" : "/coach";
    const items = getClientsTabItems(prefix).filter((item: ToolsHubTabItem) => {
      if (item.href === "/admin/lead-finder") return leadFinderAllowed;
      if (item.adminPreview && !isAdminUser) return false;
      return true;
    });
    return (
      <PageHeaderUnderlineTabs
        ariaLabel="Get Clients tools"
        items={items.map((item) => {
          const iconOnly = Boolean(item.iconOnly);
          const label = iconOnly ? (
            <span
              className="inline-flex items-center gap-1"
              title={item.label}
              aria-label={item.label}
            >
              <Settings className="h-4 w-4" aria-hidden />
              {item.adminPreview ? (
                <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              ) : null}
              <span className="sr-only">
                {item.label}
                {item.adminPreview
                  ? " (admin preview — not released to coaches)"
                  : ""}
              </span>
            </span>
          ) : (
            previewTabLabel(item.label, Boolean(item.adminPreview))
          );
          return {
            kind: "link" as const,
            href: item.href,
            label,
            active: navLinkActive(pathname, item.href),
            scroll: false,
            variant: item.adminPreview
              ? ("subtle" as const)
              : ("default" as const),
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
      showAdminPreview={isAdminUser}
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
            showAdminPreview={pathname.startsWith("/admin")}
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
