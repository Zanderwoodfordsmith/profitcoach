"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  DashboardPageSection,
  StickyPageHeader,
} from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { ProspectJourneyPane } from "@/components/prospects/ProspectJourneyPane";
import type { ProspectRow } from "@/lib/prospectRow";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type Props = {
  contactId: string;
};

export function ProspectWorkspace({ contactId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isAdmin = pathname.startsWith("/admin");
  const { impersonatingCoachId, setImpersonatingCoachId } = useImpersonation();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expectedCoachId, setExpectedCoachId] = useState<string | null>(null);
  const [prospect, setProspect] = useState<ProspectRow | null>(null);

  const fromConversations = searchParams.get("from") === "conversations";
  const fromPool = searchParams.get("from") === "pool";
  const hubPrefix = isAdmin ? "/admin" : "/coach";
  const backHref = fromPool
    ? `${hubPrefix}/campaigns?tab=pool`
    : fromConversations
      ? `${hubPrefix}/conversations`
      : `${hubPrefix}/prospects`;
  const backLabel = fromPool
    ? "Pool"
    : fromConversations
      ? "Conversations"
      : "Prospects";

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getValidSupabaseAccessToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (!isAdmin && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const contactUrl = isAdmin
        ? `/api/admin/contacts/${encodeURIComponent(contactId)}`
        : `/api/coach/contacts/${encodeURIComponent(contactId)}`;
      const res = await fetch(contactUrl, { headers, cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        prospect?: ProspectRow;
        error?: string;
      };
      if (!res.ok || !body.prospect) {
        setError(body.error ?? "Prospect not found.");
        return;
      }
      setProspect(body.prospect);
      if (isAdmin && body.prospect.coach_id) {
        setImpersonatingCoachId(body.prospect.coach_id);
        setExpectedCoachId(body.prospect.coach_id);
      } else {
        setExpectedCoachId(null);
      }
      setReady(true);
    } catch {
      setError("Unable to load prospect.");
    }
  }, [
    contactId,
    impersonatingCoachId,
    isAdmin,
    router,
    setImpersonatingCoachId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const canOpenInbox =
    ready &&
    Boolean(prospect) &&
    (!expectedCoachId || impersonatingCoachId === expectedCoachId);

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
      {error ? (
        <p className="px-1 py-6 text-sm text-rose-600">{error}</p>
      ) : !canOpenInbox ? (
        <p className="px-1 py-6 text-sm text-slate-600">Loading…</p>
      ) : (
        <MessagingInbox
          key={contactId}
          contactId={contactId}
          initialProspect={prospect}
          detailsSide="left"
          hideConversationList
          hideProspectLink
          detailsBackHref={backHref}
          detailsBackLabel={backLabel}
          journeyPane={
            <ProspectJourneyPane
              contactId={contactId}
              impersonateCoachId={impersonatingCoachId}
              prospect={prospect}
              onProspectBooked={(row) => setProspect(row)}
            />
          }
        />
      )}
    </DashboardPageSection>
  );
}
