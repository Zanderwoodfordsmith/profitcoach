"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getStoredImpersonatingCoachId } from "@/lib/coachAuthHeaders";
import { supabaseClient } from "@/lib/supabaseClient";
import { NewsletterIssuesTab } from "./NewsletterIssuesTab";
import { useLinkedInHistory } from "./useLinkedInHistory";

/** Get Clients → Newsletter: the coach's drafts and published issues. The open issue is in the address (?issue=). */
export function NewsletterPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onAdmin = pathname?.startsWith("/admin") ?? false;
  // An admin using "Use as" sees that coach's issues and drafts.
  const { impersonatingCoachId } = useImpersonation();
  const coachId = onAdmin ? null : (impersonatingCoachId ?? getStoredImpersonatingCoachId());

  // Switching coach: the open issue belongs to the last coach, so go back to the list.
  const lastCoachId = useRef(coachId);
  useEffect(() => {
    if (lastCoachId.current === coachId) return;
    lastCoachId.current = coachId;
    if (!searchParams.get("issue")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("issue");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [coachId, pathname, router, searchParams]);

  // Keyed by coach so the old coach's issues and half-typed edits never show for the new one.
  return <NewsletterPageBody key={coachId ?? "self"} coachId={coachId} onAdmin={onAdmin} />;
}

function NewsletterPageBody({ coachId, onAdmin }: { coachId: string | null; onAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const getHeaders = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return null;
      return {
        Authorization: `Bearer ${session.access_token}`,
        ...(coachId ? { "x-impersonate-coach-id": coachId } : {}),
      };
    } catch {
      return null;
    }
  }, [coachId]);
  const history = useLinkedInHistory(getHeaders);

  const openIssue = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("issue", id);
      else params.delete("issue");
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // The issue's bars pin just under the page header, whatever its height.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{ ["--nl-sticky-top" as string]: `${headerHeight}px` }}
    >
      <StickyPageHeader
        rootRef={headerRef}
        title="Get Calls"
        description="Write and edit your newsletter issues."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />
      <NewsletterIssuesTab
        history={history.data}
        loading={history.loading}
        importing={history.importing}
        onImport={() => void history.runImport()}
        getHeaders={getHeaders}
        openIssueId={searchParams.get("issue")}
        onOpenIssue={openIssue}
        blueprintHref={onAdmin ? null : "/coach/blueprint/content"}
        onDraftSaved={() => void history.reload()}
      />
    </div>
  );
}
