"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  DashboardPageSection,
  StickyPageHeader,
} from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { seedProspectContactCache } from "@/lib/getClients/hubFetchers";
import {
  loadProspectFeed,
  prefetchProspectThread,
  rememberProspectConversation,
} from "@/lib/messaging/prefetchProspectOpen";
import { isLeadListUuid } from "@/lib/leadLists/audienceLists";
import {
  liteProspectFromPool,
  peekPendingPoolPerson,
  poolPersonHref,
  requestPoolPersonOpen,
} from "@/lib/pool/pendingPoolOpen";

export function PoolPersonOpenGate() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = pathname.startsWith("/admin");
  const { impersonatingCoachId } = useImpersonation();
  const itemId = (searchParams.get("item") || "").trim();
  const pending = itemId ? peekPendingPoolPerson(itemId) : null;
  const [error, setError] = useState<string | null>(null);
  const hubPrefix = isAdmin ? "/admin" : "/coach";
  const backHref = `${hubPrefix}/campaigns?tab=pool`;
  const name = pending?.full_name?.trim() || "Opening…";
  const subtitle = [pending?.job_title, pending?.company]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    if (!itemId || !isLeadListUuid(itemId)) {
      setError("This pool person could not be opened.");
      return;
    }
    let cancelled = false;
    void (async () => {
      const body = await requestPoolPersonOpen(itemId, impersonatingCoachId);
      if (cancelled) return;
      if (!body.contactId) {
        setError(body.error || "Could not open this person.");
        return;
      }
      const row = peekPendingPoolPerson(itemId);
      if (row) {
        seedProspectContactCache(
          body.contactId,
          isAdmin,
          liteProspectFromPool(row, body.contactId),
          impersonatingCoachId
        );
      }
      if (body.conversation?.id) {
        rememberProspectConversation(
          body.contactId,
          body.conversation,
          impersonatingCoachId
        );
        prefetchProspectThread(body.conversation.id, impersonatingCoachId);
      }
      void loadProspectFeed(body.contactId, impersonatingCoachId);
      if (cancelled) return;
      router.replace(poolPersonHref(body.contactId, isAdmin));
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId, isAdmin, itemId, router]);

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-0"
      outerClassName="h-full min-h-0 flex-1"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        <StickyPageHeader
          className="shrink-0"
          title="Get Clients"
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col py-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="truncate text-sm font-semibold text-slate-900">
              {name}
            </div>
            {subtitle ? (
              <div className="truncate text-[13px] text-slate-600">{subtitle}</div>
            ) : null}
          </div>
          <div className="px-4 py-6">
            {error ? (
              <div className="space-y-3">
                <p className="text-sm text-rose-600">{error}</p>
                <Link
                  href={backHref}
                  className="text-sm font-medium text-[#0c5290] hover:underline"
                >
                  Back to Pool
                </Link>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Opening…</p>
            )}
          </div>
        </div>
      </div>
    </DashboardPageSection>
  );
}
