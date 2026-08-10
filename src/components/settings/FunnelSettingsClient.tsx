"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DashboardPageSection,
  StickyPageHeader,
} from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { GoogleCalendarBookingCard } from "@/components/booking/GoogleCalendarBookingCard";
import { NativeBookingSettingsCard } from "@/components/booking/NativeBookingSettingsCard";
import { FunnelSettingsTab } from "@/components/settings/FunnelSettingsTab";
import { getCalendarSyncStatus, validateCrmLocationId } from "@/lib/ghlCalendarSync";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type FunnelProfileData = {
  coach_slug: string | null;
  lead_webhook_url?: string | null;
  crm_profile_name?: string | null;
  crm_location_id?: string | null;
  calendar_embed_code?: string | null;
  landing_copy_overrides?: Record<string, string> | null;
};

type FunnelSettingsClientProps = {
  /** When true, render body only (no Get Clients hub header) — e.g. Profile settings tab. */
  embed?: boolean;
};

/**
 * Get Clients → Settings: share links, slug, CRM, and funnel landing copy.
 */
export function FunnelSettingsClient({ embed = false }: FunnelSettingsClientProps = {}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const { impersonatingCoachId } = useImpersonation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadWebhookUrl, setLeadWebhookUrl] = useState("");
  const [calendarEmbedCode, setCalendarEmbedCode] = useState("");
  const [coachSlug, setCoachSlug] = useState("");
  const [crmProfileName, setCrmProfileName] = useState("");
  const [crmLocationId, setCrmLocationId] = useState("");
  const [landingEyebrow, setLandingEyebrow] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | null>(
    null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("https://theprofitcoach.com");

  const calendarSyncStatus = useMemo(
    () =>
      getCalendarSyncStatus({
        crmLocationId,
        calendarEmbedCode,
        leadWebhookUrl,
        audience: "coach",
      }),
    [crmLocationId, calendarEmbedCode, leadWebhookUrl]
  );

  const loadProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      return;
    }

    const roleRes = await fetch("/api/profile-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const roleBody = (await roleRes.json().catch(() => ({}))) as {
      role?: string;
    };
    if (!roleRes.ok || !roleBody.role) {
      setError("Unable to load your profile.");
      setLoading(false);
      return;
    }
    if (roleBody.role === "admin" && !isAdmin && !impersonatingCoachId) {
      router.replace("/admin/funnel-settings");
      return;
    }
    if (!isAdmin && roleBody.role !== "coach" && roleBody.role !== "admin") {
      router.replace("/login");
      return;
    }
    if (isAdmin && roleBody.role !== "admin") {
      router.replace("/coach/funnel-settings");
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (roleBody.role === "admin" && impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch("/api/coach/profile", { headers });
    if (!res.ok) {
      setError("Could not load profile.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as FunnelProfileData;
    setLeadWebhookUrl(data.lead_webhook_url ?? "");
    setCalendarEmbedCode(data.calendar_embed_code ?? "");
    setCoachSlug(data.coach_slug ?? "");
    setCrmProfileName(data.crm_profile_name ?? "");
    setCrmLocationId(data.crm_location_id ?? "");
    setLandingEyebrow(data.landing_copy_overrides?.eyebrow ?? "");
    setLoading(false);
  }, [router, impersonatingCoachId, isAdmin]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      setAppOrigin(window.location.origin);
    }
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);
    setSaveError(null);

    const normalizedSlug = coachSlug.toLowerCase().trim();
    if (!normalizedSlug) {
      setSaveMessage("error");
      setSaveError("Slug is required.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      setSaveMessage("error");
      setSaveError(
        "Slug can only contain lowercase letters, numbers, and hyphens."
      );
      return;
    }

    const locationValidation = validateCrmLocationId(crmLocationId);
    if (!locationValidation.ok) {
      setSaveMessage("error");
      setSaveError(locationValidation.error);
      return;
    }

    const trimmedWebhook = leadWebhookUrl.trim();
    if (trimmedWebhook && !/^https?:\/\//i.test(trimmedWebhook)) {
      setSaveMessage("error");
      setSaveError("Lead webhook URL must start with http:// or https://.");
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    setSaving(true);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        slug: normalizedSlug,
        crm_profile_name: crmProfileName.trim() || null,
        crm_location_id: locationValidation.value,
        lead_webhook_url: trimmedWebhook || null,
        calendar_embed_code: calendarEmbedCode.trim() || null,
        landing_copy_overrides: landingEyebrow.trim()
          ? { eyebrow: landingEyebrow.trim() }
          : {},
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (res.ok) {
      setSaveMessage("success");
      void loadProfile();
    } else {
      setSaveMessage("error");
      setSaveError(body.error ?? "Save failed.");
    }
  }

  const body = loading ? (
    <p className="text-sm text-slate-600">Loading…</p>
  ) : error ? (
    <p className="text-sm text-rose-600">{error}</p>
  ) : (
    <div className="flex flex-col gap-6">
      <FunnelSettingsTab
        appOrigin={appOrigin}
        prospectsHref={isAdmin ? "/admin/prospects" : "/coach/prospects"}
        coachSlug={coachSlug}
        onCoachSlugChange={setCoachSlug}
        landingEyebrow={landingEyebrow}
        onLandingEyebrowChange={setLandingEyebrow}
        crmProfileName={crmProfileName}
        onCrmProfileNameChange={setCrmProfileName}
        crmLocationId={crmLocationId}
        onCrmLocationIdChange={setCrmLocationId}
        calendarEmbedCode={calendarEmbedCode}
        onCalendarEmbedCodeChange={setCalendarEmbedCode}
        leadWebhookUrl={leadWebhookUrl}
        onLeadWebhookUrlChange={setLeadWebhookUrl}
        calendarSyncStatus={calendarSyncStatus}
        impersonatingCoachId={impersonatingCoachId}
        saving={saving}
        saveMessage={saveMessage}
        saveError={saveError}
        onSubmit={(e) => void handleSave(e)}
      />
      {isAdmin ? <NativeBookingSettingsCard appOrigin={appOrigin} /> : null}
      <Suspense
        fallback={
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading Google Calendar…</p>
          </section>
        }
      >
        <GoogleCalendarBookingCard />
      </Suspense>
    </div>
  );

  if (embed) {
    return <div className="flex w-full min-w-0 flex-col gap-6">{body}</div>;
  }

  return (
    <DashboardPageSection
      gapClass="gap-6"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="Share links, CRM sync, and funnel landing copy."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
      contentMaxWidthClass="max-w-6xl"
      contentClassName="mx-0 mr-auto w-full"
    >
      {body}
    </DashboardPageSection>
  );
}
