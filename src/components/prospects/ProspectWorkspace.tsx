"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  DashboardPageSection,
  StickyPageHeader,
} from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";
import { ProspectJourneyPane } from "@/components/prospects/ProspectJourneyPane";
import type { ProspectRow } from "@/lib/prospectRow";
import { fetchHubQuery, peekHubQuery } from "@/lib/getClients/hubQueryCache";
import {
  loadProspectContactPayload,
  prospectContactQueryKey,
  type ProspectContactPayload,
} from "@/lib/getClients/hubFetchers";

type Props = {
  contactId: string;
};

export function ProspectWorkspace({ contactId }: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isAdmin = pathname.startsWith("/admin");
  const { impersonatingCoachId, setImpersonatingCoachId } = useImpersonation();
  const cacheKey = prospectContactQueryKey(
    contactId,
    isAdmin,
    impersonatingCoachId
  );
  const cached = peekHubQuery<ProspectContactPayload>(cacheKey);

  const [error, setError] = useState<string | null>(null);
  const [expectedCoachId, setExpectedCoachId] = useState<string | null>(() =>
    isAdmin ? cached?.prospect.coach_id ?? null : null
  );
  const [prospect, setProspect] = useState<ProspectRow | null>(
    () => cached?.prospect ?? null
  );
  const [coachSlug, setCoachSlug] = useState<string | null>(
    () => cached?.coachSlug ?? null
  );

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
      const payload = await fetchHubQuery(cacheKey, () =>
        loadProspectContactPayload(contactId, isAdmin, impersonatingCoachId)
      );
      setProspect(payload.prospect);
      setCoachSlug(payload.coachSlug ?? null);
      if (isAdmin && payload.prospect.coach_id) {
        setImpersonatingCoachId(payload.prospect.coach_id);
        setExpectedCoachId(payload.prospect.coach_id);
      } else {
        setExpectedCoachId(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load prospect.";
      if (
        message.includes("x-impersonate-coach-id") &&
        !impersonatingCoachId
      ) {
        return;
      }
      setError(message);
    }
  }, [
    cacheKey,
    contactId,
    impersonatingCoachId,
    isAdmin,
    setImpersonatingCoachId,
  ]);

  useEffect(() => {
    const hit = peekHubQuery<ProspectContactPayload>(cacheKey);
    if (hit?.prospect) {
      setProspect(hit.prospect);
      setCoachSlug(hit.coachSlug ?? null);
      if (isAdmin && hit.prospect.coach_id) {
        setImpersonatingCoachId(hit.prospect.coach_id);
        setExpectedCoachId(hit.prospect.coach_id);
      }
    }
    void load();
  }, [cacheKey, isAdmin, load, setImpersonatingCoachId]);

  useEffect(() => {
    if (!isAdmin || !prospect?.coach_id) return;
    if (impersonatingCoachId !== prospect.coach_id) {
      setImpersonatingCoachId(prospect.coach_id);
      setExpectedCoachId(prospect.coach_id);
    }
  }, [
    impersonatingCoachId,
    isAdmin,
    prospect?.coach_id,
    setImpersonatingCoachId,
  ]);

  const waitingOnAdminScope =
    isAdmin &&
    Boolean(expectedCoachId) &&
    impersonatingCoachId !== expectedCoachId;
  const canOpenInbox = Boolean(contactId) && !waitingOnAdminScope;

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
      {error && !canOpenInbox ? (
        <p className="px-1 py-6 text-sm text-rose-600">{error}</p>
      ) : !canOpenInbox ? (
        <p className="px-1 py-6 text-sm text-slate-600">Loading…</p>
      ) : (
        <MessagingInbox
          key={contactId}
          contactId={contactId}
          initialProspect={prospect}
          initialCoachSlug={coachSlug}
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
