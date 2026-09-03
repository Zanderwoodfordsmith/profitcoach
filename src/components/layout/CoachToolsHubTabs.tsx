"use client";

import { Lock, Settings } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  coachClientsTabActive,
  coachClientsTabItems,
  getClientsTabItems,
  isGetClientsContentPath,
  navLinkActive,
  type CoachClientsTabItem,
  type ToolsHubTabItem,
} from "@/components/layout/dashboardNavItems";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";

export type CoachToolsHub = "get-clients" | "coach-clients";

type Props = {
  hub: CoachToolsHub;
};

/**
 * Unreleased tabs: admins on the admin surface always see them (grey + locked).
 * Coaches — and admins “View as coach” on /coach — never see them.
 * Impersonation must not hide preview tabs while browsing /admin.
 */
function useShowAdminPreviewTabs(onAdminPath: boolean): boolean {
  const { impersonatingCoachId } = useImpersonation();
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

  if (!isAdminUser) return false;
  if (onAdminPath) return true;
  return !impersonatingCoachId;
}

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
  showAdminPreview,
}: {
  pathname: string;
  search: string;
  showAdminPreview: boolean;
}) {
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const items = coachClientsTabItems(prefix).filter(
    (item: CoachClientsTabItem) => showAdminPreview || !item.adminPreview
  );
  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Coach Clients tools"
      items={items.map((item) => ({
        kind: "link" as const,
        href: item.href,
        label: previewTabLabel(
          item.label,
          Boolean(item.adminPreview && showAdminPreview)
        ),
        active: coachClientsTabActive(pathname, search, item.key),
        scroll: false,
        variant:
          item.adminPreview && showAdminPreview
            ? ("subtle" as const)
            : ("default" as const),
      }))}
    />
  );
}

function CoachToolsHubTabsInner({ hub }: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const onAdminPath = pathname.startsWith("/admin");
  const showAdminPreview = useShowAdminPreviewTabs(onAdminPath);

  if (hub === "get-clients") {
    const prefix = onAdminPath ? "/admin" : "/coach";
    const items = getClientsTabItems(prefix).filter((item: ToolsHubTabItem) => {
      if (item.adminPreview && !showAdminPreview) return false;
      return true;
    });
    const contentHref = "/admin/linkedin";
    return (
      <PageHeaderUnderlineTabs
        ariaLabel="Get Clients tools"
        items={items.map((item) => {
          const iconOnly = Boolean(item.iconOnly);
          const preview = Boolean(item.adminPreview && showAdminPreview);
          const label = iconOnly ? (
            <span
              className="inline-flex items-center gap-1"
              title={item.label}
              aria-label={item.label}
            >
              <Settings className="h-4 w-4" aria-hidden />
              {preview ? (
                <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              ) : null}
              <span className="sr-only">
                {item.label}
                {preview ? " (admin preview — not released to coaches)" : ""}
              </span>
            </span>
          ) : (
            previewTabLabel(item.label, preview)
          );
          const active =
            item.href === contentHref
              ? isGetClientsContentPath(pathname)
              : navLinkActive(pathname, item.href);
          return {
            kind: "link" as const,
            href: item.href,
            label,
            active,
            scroll: false,
            variant: preview ? ("subtle" as const) : ("default" as const),
          };
        })}
      />
    );
  }

  return (
    <CoachClientsTabsNav
      pathname={pathname}
      search={search}
      showAdminPreview={showAdminPreview}
    />
  );
}

/**
 * Underline tabs for the Tools hubs (Get Clients / Coach Clients).
 * Works for both /coach and /admin — former Marketing and Delivery links live here.
 */
export function CoachToolsHubTabs(props: Props) {
  const pathname = usePathname() ?? "";
  const { impersonatingCoachId } = useImpersonation();
  // Prefer coach product surface while impersonating; avoid flashing locked tabs.
  const fallbackShowAdminPreview =
    pathname.startsWith("/admin") && !impersonatingCoachId;

  // Coach Clients: never flash an empty nav — Suspense fallback still lists every tab.
  if (props.hub === "coach-clients") {
    return (
      <Suspense
        fallback={
          <CoachClientsTabsNav
            pathname={pathname}
            search=""
            showAdminPreview={fallbackShowAdminPreview}
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
