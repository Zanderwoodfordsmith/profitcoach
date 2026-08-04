"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClientOverviewPanel } from "@/components/clientCoaching/ClientOverviewPanel";
import { ComingSoonPanel } from "@/components/clientCoaching/ComingSoonPanel";
import { NinetyDayPlanPanel } from "@/components/clientCoaching/NinetyDayPlanPanel";
import { ThreeYearPlanPanel } from "@/components/clientCoaching/ThreeYearPlanPanel";
import { CoachClientHubGate } from "@/components/coach/CoachClientHubGate";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  createEmptyCoachingPlan,
  LAST_CLIENT_WORKSPACE_KEY,
} from "@/lib/clientCoaching/defaults";
import { parseClientWorkspaceTab } from "@/lib/clientCoaching/normalize";
import type {
  ClientWorkspaceContact,
  CoachingPlanDocument,
} from "@/lib/clientCoaching/types";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  contactId: string;
};

export function ClientCoachingWorkspace({ contactId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseClientWorkspaceTab(searchParams.get("tab"));
  const { impersonatingCoachId, setImpersonatingContactId } = useImpersonation();

  const [contact, setContact] = useState<ClientWorkspaceContact | null>(null);
  const [plan, setPlan] = useState<CoachingPlanDocument>(createEmptyCoachingPlan());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_CLIENT_WORKSPACE_KEY, contactId);
    } catch {
      /* ignore */
    }
  }, [contactId]);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [impersonatingCoachId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const headers = await authHeaders();
      if (!headers) {
        router.replace("/login");
        return;
      }
      const res = await fetch(
        `/api/coach/contacts/${encodeURIComponent(contactId)}/coaching-plan`,
        { headers }
      );
      if (cancelled) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Unable to load client workspace.");
        setLoading(false);
        return;
      }
      const body = (await res.json()) as {
        contact: ClientWorkspaceContact;
        plan: CoachingPlanDocument;
      };
      setContact(body.contact);
      setPlan(body.plan);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, contactId, router]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You must be signed in.");
      const res = await fetch(
        `/api/coach/contacts/${encodeURIComponent(contactId)}/coaching-plan`,
        {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        plan?: CoachingPlanDocument;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to save plan.");
      }
      if (body.plan) setPlan(body.plan);
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save plan.");
    } finally {
      setSaving(false);
    }
  }

  function handleViewAsClient() {
    setImpersonatingContactId(contactId);
    router.push("/client");
  }

  const title = contact?.fullName ?? "Client";

  return (
    <CoachClientHubGate>
      <div className="flex flex-col gap-4">
        <StickyPageHeader
          title="Coach Clients"
          description="Per-client coaching workspace — plan, delivery tools, and links."
          below={
            <div className="flex flex-col gap-2">
              <CoachToolsHubTabs hub="coach-clients" contactId={contactId} />
              {loading ? null : (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                    {title}
                  </h2>
                  {contact?.businessName ? (
                    <span className="text-sm text-slate-500">
                      {contact.businessName}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          }
        />

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {!loading && !error && contact ? (
          <div className="w-full">
            {tab === "overview" ? (
              <ClientOverviewPanel
                contact={contact}
                onViewAsClient={handleViewAsClient}
              />
            ) : null}
            {tab === "plan" ? (
              <ThreeYearPlanPanel
                plan={plan}
                saving={saving}
                saveError={saveError}
                saveOk={saveOk}
                onChange={setPlan}
                onSave={() => void handleSave()}
              />
            ) : null}
            {tab === "ninety-day" ? (
              <NinetyDayPlanPanel
                contactId={contactId}
                plan={plan}
                saving={saving}
                saveError={saveError}
                saveOk={saveOk}
                onChange={setPlan}
                onSave={() => void handleSave()}
              />
            ) : null}
            {tab === "revenue" ? (
              <ComingSoonPanel
                title="Revenue by month"
                description="A client-facing revenue accelerator — monthly targets and actuals, adapted from the patterns already used in cash flow and income tools."
              />
            ) : null}
            {tab === "expenses" ? (
              <ComingSoonPanel
                title="Business expenses"
                description="An editable expense model any coach can use with a client — generic, not tied to BCA admin ops."
              />
            ) : null}
            {tab === "team" ? (
              <ComingSoonPanel
                title="Team assessment"
                description="A clearer, modern take on the masterfile team assessment for delivery conversations."
              />
            ) : null}
            {tab === "notes" ? (
              <ComingSoonPanel
                title="Coaching notes"
                description="A lightweight coaching sheet for session notes. Full digital coaching sheet comes later."
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </CoachClientHubGate>
  );
}
