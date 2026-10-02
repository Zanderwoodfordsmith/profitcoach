"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientOverviewPanel } from "@/components/clientCoaching/ClientOverviewPanel";
import { PersonIdentityDialog } from "@/components/contacts/PersonIdentityDialog";
import { EditPersonNameButton } from "@/components/contacts/EditPersonIdentityButtons";
import { savePersonIdentity } from "@/lib/contacts/savePersonIdentity";
import { suggestContactIdentity } from "@/lib/contacts/suggestContactIdentity";
import { ComingSoonPanel } from "@/components/clientCoaching/ComingSoonPanel";
import { NinetyDayPlanPanel } from "@/components/clientCoaching/NinetyDayPlanPanel";
import { ThreeYearPlanPanel } from "@/components/clientCoaching/ThreeYearPlanPanel";
import { ClientNotesPanel } from "@/components/clients/ClientNotesPanel";
import { CoachClientHubGate } from "@/components/coach/CoachClientHubGate";
import { StickyPageHeader } from "@/components/layout";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  CLIENT_WORKSPACE_TAB_LABELS,
  createEmptyCoachingPlan,
  LAST_CLIENT_WORKSPACE_KEY,
  clientWorkspacePath,
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
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const prefix = isAdmin ? "/admin" : "/coach";
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
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const appliedIdentityRef = useRef("");
  const dismissedBusinessRef = useRef(false);

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

  async function saveIdentity(input: {
    firstName: string;
    lastName: string;
    businessName: string;
    photoFile: File | null;
    removePhoto: boolean;
  }) {
    if (!input.businessName.trim()) dismissedBusinessRef.current = true;
    setIdentitySaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You must be signed in.");
      const updated = await savePersonIdentity({
        contactId,
        headers,
        admin: isAdmin,
        input,
      });
      setContact((prev) =>
        prev
          ? {
              ...prev,
              fullName: updated.full_name,
              firstName: updated.first_name,
              lastName: updated.last_name,
              businessName: updated.business_name,
              photoUrl: updated.photo_url,
            }
          : prev
      );
      setIdentityOpen(false);
    } finally {
      setIdentitySaving(false);
    }
  }

  const identitySuggestion = useMemo(
    () =>
      contact
        ? suggestContactIdentity({
            fullName: contact.fullName,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            businessName: contact.businessName,
          })
        : null,
    [contact]
  );
  const shownName =
    identitySuggestion?.displayName ||
    contact?.fullName ||
    (loading ? "Loading…" : "Client");
  const shownBusiness = dismissedBusinessRef.current
    ? contact?.businessName?.trim() || null
    : identitySuggestion?.shownBusiness || null;

  useEffect(() => {
    if (!contact || !identitySuggestion) return;
    const persistBusiness =
      identitySuggestion.persistBusiness && !dismissedBusinessRef.current;
    if (!identitySuggestion.persistName && !persistBusiness) return;
    const token = [
      contact.id,
      identitySuggestion.persistName ? identitySuggestion.displayName : "",
      persistBusiness ? identitySuggestion.shownBusiness : "",
    ].join("|");
    if (appliedIdentityRef.current === token) return;
    appliedIdentityRef.current = token;
    const contactIdAtSave = contact.id;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const url = isAdmin
        ? `/api/admin/contacts/${encodeURIComponent(contactIdAtSave)}`
        : `/api/coach/contacts/${encodeURIComponent(contactIdAtSave)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          ...(identitySuggestion.persistName
            ? {
                first_name: identitySuggestion.firstName,
                last_name: identitySuggestion.lastName,
              }
            : {}),
          ...(persistBusiness
            ? { business_name: identitySuggestion.shownBusiness }
            : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        full_name?: string;
        first_name?: string | null;
        last_name?: string | null;
        business_name?: string | null;
      };
      if (!res.ok) return;
      setContact((prev) =>
        prev && prev.id === contactIdAtSave
          ? {
              ...prev,
              fullName: body.full_name ?? prev.fullName,
              firstName: body.first_name ?? prev.firstName,
              lastName: body.last_name ?? prev.lastName,
              businessName:
                body.business_name !== undefined
                  ? body.business_name
                  : prev.businessName,
            }
          : prev
      );
    })();
  }, [authHeaders, contact, identitySuggestion, isAdmin]);

  const title = shownName;

  return (
    <CoachClientHubGate>
      <div className="flex flex-col gap-4">
        <StickyPageHeader
          leading={
            <Link
              href={`${prefix}/clients`}
              className="text-sm font-medium text-sky-800 hover:text-sky-950"
            >
              ← Clients
            </Link>
          }
          title={
            contact ? (
              <EditPersonNameButton
                name={shownName}
                onClick={() => setIdentityOpen(true)}
                nameClassName="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
              />
            ) : (
              title
            )
          }
          description={
            shownBusiness
              ? shownBusiness
              : "Coaching workspace — sessions, notes, plans, and activity."
          }
          descriptionPlacement={shownBusiness ? "below" : "info"}
          tabs={
            <PageHeaderUnderlineTabs
              ariaLabel="Client workspace"
              items={CLIENT_WORKSPACE_TAB_LABELS.map((item) => ({
                kind: "link" as const,
                href: clientWorkspacePath(contactId, item.id, {
                  admin: isAdmin,
                }),
                label: item.label,
                active: tab === item.id,
                scroll: false,
              }))}
            />
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
                contactId={contactId}
                onViewAsClient={handleViewAsClient}
                onEditIdentity={() => setIdentityOpen(true)}
                impersonateCoachId={impersonatingCoachId}
                isAdmin={isAdmin}
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
              <ClientNotesPanel
                contactId={contactId}
                impersonateCoachId={impersonatingCoachId}
              />
            ) : null}
          </div>
        ) : null}
        {contact ? (
          <PersonIdentityDialog
            open={identityOpen}
            saving={identitySaving}
            fullName={shownName}
            email={contact.email}
            firstName={identitySuggestion?.firstName || contact.firstName}
            lastName={identitySuggestion?.lastName || contact.lastName}
            businessName={shownBusiness}
            photoUrl={contact.photoUrl}
            onClose={() => {
              if (!identitySaving) setIdentityOpen(false);
            }}
            onSave={saveIdentity}
          />
        ) : null}
      </div>
    </CoachClientHubGate>
  );
}
