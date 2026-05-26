"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DashboardPageSection,
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { AccountEmailPasswordFields } from "@/components/settings/AccountEmailPasswordFields";
import { ProfileSecurityFields } from "@/components/settings/ProfileSecurityFields";
import { ProfileAvatarPicker } from "@/components/settings/ProfileAvatarPicker";
import {
  OutlinedTextArea,
  OutlinedTextField,
} from "@/components/settings/OutlinedFormField";
import { FunnelSettingsTab } from "@/components/settings/FunnelSettingsTab";
import { MapLocationPickerModal } from "@/components/settings/MapLocationPickerModal";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import { getCalendarSyncStatus, validateCrmLocationId } from "@/lib/ghlCalendarSync";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type ProfileData = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  bio: string | null;
  community_bio: string | null;
  directory_summary: string | null;
  directory_bio: string | null;
  location: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_geocoded_source?: string | null;
  ai_context?: CoachAiContext | null;
  coach_slug: string | null;
  directory_listed: boolean;
  directory_level: string | null;
  /** Outbound URL fired with prospect contact info + BOSS score. */
  lead_webhook_url?: string | null;
  crm_profile_name?: string | null;
  crm_location_id?: string | null;
  calendar_embed_code?: string | null;
  crm_location_configured?: boolean;
  has_calendar_embed?: boolean;
  calendar_sync_ready?: boolean;
  /** Default funnel variant when share link has no ?variant= or cookie. */
  landing_variant_preference?: "a" | "b" | "c" | "d" | null;
  landing_copy_overrides?: Record<string, string> | null;
};

export type BossDashboardSettingsTabId =
  | "profile"
  | "funnel"
  | "workspace";

export type BossDashboardSettingsProps = {
  variant: "coach" | "admin";
  /** Parent supplies tab when embedded in admin Account (no duplicate header). */
  embed?: { activeTab: BossDashboardSettingsTabId };
};

export function BossDashboardSettings({
  variant,
  embed,
}: BossDashboardSettingsProps) {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [communityBio, setCommunityBio] = useState("");
  const [directorySummary, setDirectorySummary] = useState("");
  const [directoryBio, setDirectoryBio] = useState("");
  const [location, setLocation] = useState("");
  const [leadWebhookUrl, setLeadWebhookUrl] = useState("");
  const [calendarEmbedCode, setCalendarEmbedCode] = useState("");
  const [coachSlug, setCoachSlug] = useState("");
  const [crmProfileName, setCrmProfileName] = useState("");
  const [crmLocationId, setCrmLocationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [directoryListed, setDirectoryListed] = useState(false);
  const [directoryToggleBusy, setDirectoryToggleBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [landingEyebrow, setLandingEyebrow] = useState("");

  const [brainSuperpowers, setBrainSuperpowers] = useState("");
  const [brainHobbies, setBrainHobbies] = useState("");
  const [brainClientResults, setBrainClientResults] = useState<
    Array<{ title: string; story: string }>
  >([]);

  const [internalTab, setInternalTab] =
    useState<BossDashboardSettingsTabId>("profile");
  const activeTab = embed?.activeTab ?? internalTab;
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceSaveMessage, setWorkspaceSaveMessage] = useState<
    "success" | "error" | null
  >(null);
  const [workspaceSaveError, setWorkspaceSaveError] = useState<string | null>(
    null
  );

  const [funnelSaving, setFunnelSaving] = useState(false);
  const [funnelSaveMessage, setFunnelSaveMessage] = useState<
    "success" | "error" | null
  >(null);
  const [funnelSaveError, setFunnelSaveError] = useState<string | null>(null);

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
      error?: string;
    };
    if (!roleRes.ok || !roleBody.role) {
      setError("Unable to load your profile.");
      setLoading(false);
      return;
    }
    if (
      variant === "coach" &&
      roleBody.role === "admin" &&
      !impersonatingCoachId
    ) {
      router.replace("/admin");
      return;
    }
    if (variant === "admin" && roleBody.role !== "admin") {
      router.replace("/coach");
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
    const data = (await res.json()) as ProfileData;
    setProfile(data);
    setDirectoryListed(!!data.directory_listed);
    setDirectoryError(null);
    setFirstName(data.first_name ?? "");
    setLastName(data.last_name ?? "");
    setBusinessName(data.coach_business_name ?? "");
    setLinkedinUrl(data.linkedin_url ?? "");
    setCommunityBio(data.community_bio ?? data.bio ?? "");
    setDirectorySummary(data.directory_summary ?? data.bio ?? "");
    setDirectoryBio(data.directory_bio ?? "");
    setLocation(data.location ?? "");
    setLeadWebhookUrl(data.lead_webhook_url ?? "");
    setCalendarEmbedCode(data.calendar_embed_code ?? "");
    setCoachSlug(data.coach_slug ?? "");
    setCrmProfileName(data.crm_profile_name ?? "");
    setCrmLocationId(data.crm_location_id ?? "");
    setLandingEyebrow(data.landing_copy_overrides?.eyebrow ?? "");
    const ctx = data.ai_context ?? {};
    setBrainSuperpowers(ctx.superpowers ?? "");
    setBrainHobbies(ctx.hobbies_and_recent ?? "");
    setBrainClientResults(
      (ctx.client_results ?? []).map((r) => ({
        title: r.title ?? "",
        story: r.story ?? "",
      }))
    );
    setLoading(false);
  }, [router, impersonatingCoachId, variant]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read ?tab= from URL on coach settings
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "funnel" || tab === "profile" || tab === "workspace") {
      setInternalTab(tab);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data bootstrap after async profile-role + coach profile fetches
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      setAppOrigin(window.location.origin);
    }
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);
    setSaveError(null);
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
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        coach_business_name: businessName.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        community_bio: communityBio.trim() || null,
        directory_summary: directorySummary.trim() || null,
        directory_bio: directoryBio.trim() || null,
        location: location.trim() || null,
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

  async function handleWorkspaceSave(e: React.FormEvent) {
    e.preventDefault();
    setWorkspaceSaveMessage(null);
    setWorkspaceSaveError(null);
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

    setWorkspaceSaving(true);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        ai_context: {
          superpowers: brainSuperpowers.trim() || undefined,
          hobbies_and_recent: brainHobbies.trim() || undefined,
          client_results: brainClientResults.filter(
            (r) => r.title.trim() || r.story.trim()
          ),
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setWorkspaceSaving(false);
    if (res.ok) {
      setWorkspaceSaveMessage("success");
      void loadProfile();
    } else {
      setWorkspaceSaveMessage("error");
      setWorkspaceSaveError(body.error ?? "Save failed.");
    }
  }

  async function handleFunnelSave(e: React.FormEvent) {
    e.preventDefault();
    setFunnelSaveMessage(null);
    setFunnelSaveError(null);

    const normalizedSlug = coachSlug.toLowerCase().trim();
    if (!normalizedSlug) {
      setFunnelSaveMessage("error");
      setFunnelSaveError("Slug is required.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      setFunnelSaveMessage("error");
      setFunnelSaveError(
        "Slug can only contain lowercase letters, numbers, and hyphens."
      );
      return;
    }

    const locationValidation = validateCrmLocationId(crmLocationId);
    if (!locationValidation.ok) {
      setFunnelSaveMessage("error");
      setFunnelSaveError(locationValidation.error);
      return;
    }

    const trimmedWebhook = leadWebhookUrl.trim();
    if (trimmedWebhook && !/^https?:\/\//i.test(trimmedWebhook)) {
      setFunnelSaveMessage("error");
      setFunnelSaveError("Lead webhook URL must start with http:// or https://.");
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

    setFunnelSaving(true);
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
    setFunnelSaving(false);
    if (res.ok) {
      setFunnelSaveMessage("success");
      void loadProfile();
    } else {
      setFunnelSaveMessage("error");
      setFunnelSaveError(body.error ?? "Save failed.");
    }
  }

  async function persistMapPin(lat: number, lng: number) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Not signed in.");
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ map_latitude: lat, map_longitude: lng }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Could not save map pin.");
    }
    await loadProfile();
  }

  async function clearMapPin() {
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
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ clear_map_pin: true }),
    });
    if (res.ok) void loadProfile();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setUploadingAvatar(true);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setAvatarError("Not signed in.");
      setUploadingAvatar(false);
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/coach/avatar", {
      method: "POST",
      headers,
      body: formData,
    });

    setUploadingAvatar(false);
    if (res.ok) {
      const body = (await res.json()) as { avatar_url?: string };
      setProfile((prev) =>
        prev ? { ...prev, avatar_url: body.avatar_url ?? null } : null
      );
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setAvatarError(body.error ?? "Upload failed.");
    }
    e.target.value = "";
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setRemovingAvatar(true);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setAvatarError("Not signed in.");
      setRemovingAvatar(false);
      return;
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    const res = await fetch("/api/coach/avatar", { method: "DELETE", headers });
    setRemovingAvatar(false);
    if (res.ok) {
      setProfile((prev) =>
        prev ? { ...prev, avatar_url: null } : null
      );
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setAvatarError(body.error ?? "Could not remove avatar.");
    }
  }

  async function handleDirectoryToggle(next: boolean) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;

    setDirectoryError(null);
    setDirectoryToggleBusy(true);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const prev = directoryListed;
    setDirectoryListed(next);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ directory_listed: next }),
    });
    setDirectoryToggleBusy(false);
    if (!res.ok) {
      setDirectoryListed(prev);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setDirectoryError(body.error ?? "Could not update directory preference.");
      return;
    }
    setProfile((p) =>
      p ? { ...p, directory_listed: next } : null
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (!profile) {
    return null;
  }

  const hasMapPin =
    profile.latitude != null &&
    profile.longitude != null &&
    Number.isFinite(profile.latitude) &&
    Number.isFinite(profile.longitude);

  const compassHref = variant === "admin" ? "/admin/signature" : "/coach/signature";

  const tabDefs: { id: BossDashboardSettingsTabId; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "funnel", label: "Funnel" },
    { id: "workspace", label: "Workspace" },
  ];

  const settingsHeader = (
    <StickyPageHeader
      title="Settings"
      description="Profile, funnel links, and workspace."
      tabs={
        <PageHeaderUnderlineTabs
          ariaLabel="Settings sections"
          items={tabDefs.map((tab) => ({
            kind: "button" as const,
            id: tab.id,
            label: tab.label,
            active: activeTab === tab.id,
            onClick: () => setInternalTab(tab.id),
          }))}
        />
      }
    />
  );

  const settingsBody = (
    <>
      {activeTab === "profile" ? (
      <form
        onSubmit={handleProfileSave}
        className="flex w-full flex-col gap-8"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            <ProfileAvatarPicker
              avatarUrl={profile.avatar_url}
              firstName={firstName}
              lastName={lastName}
              fullName={profile.full_name}
              uploading={uploadingAvatar}
              error={avatarError}
              onFileSelected={handleAvatarChange}
              onRemoveAvatar={handleRemoveAvatar}
              removing={removingAvatar}
            />
            <div className="min-w-0 max-w-xl flex-1 space-y-6">
              <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                <OutlinedTextField
                  id="first_name"
                  label="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  wrapperClassName="w-full min-w-0"
                />
                <OutlinedTextField
                  id="last_name"
                  label="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  wrapperClassName="w-full min-w-0"
                />
              </div>
              <AccountEmailPasswordFields
                impersonatingCoachId={impersonatingCoachId}
              />
            </div>
          </div>
          <div className="mt-8 max-w-lg space-y-4 border-t border-slate-100 pt-8">
            <OutlinedTextField
              id="business_name"
              label="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              wrapperClassName="w-full max-w-md"
            />
            <OutlinedTextField
              id="linkedin_url"
              label="LinkedIn profile URL"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/yourprofile/"
              wrapperClassName="w-full max-w-lg"
            />
            <OutlinedTextArea
              id="community_bio"
              label="Community bio"
              rows={4}
              value={communityBio}
              onChange={(e) => setCommunityBio(e.target.value)}
              wrapperClassName="w-full max-w-lg"
            />
            <p className="-mt-2 max-w-lg text-xs leading-relaxed text-slate-600">
              Shown to other coaches in the community roster, sidebar hover
              cards, and members map.
            </p>
          <div>
            <OutlinedTextField
              id="location"
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, region, country"
              autoComplete="address-level2"
              wrapperClassName="w-full max-w-md"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Use whatever you&apos;re comfortable sharing. A{" "}
              <span className="font-medium text-slate-700">city and country</span>{" "}
              is enough for the community map (e.g.{" "}
              <span className="font-mono text-[11px] text-slate-700">
                Austin, TX, USA
              </span>
              ,{" "}
              <span className="font-mono text-[11px] text-slate-700">
                Manchester, UK
              </span>
              ). A full street address works too if you prefer.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMapModalOpen(true)}
                className="font-medium text-sky-700 hover:underline"
              >
                Change my map location
              </button>
              {hasMapPin ? (
                <button
                  type="button"
                  onClick={() => void clearMapPin()}
                  className="text-slate-500 hover:text-rose-600 hover:underline"
                >
                  Remove my map location
                </button>
              ) : null}
            </div>
            {profile.location_geocoded_source === "manual" ? (
              <p className="mt-2 text-xs text-slate-500">
                Pin placed manually — changing the text above won&apos;t move the
                pin until you remove it or pick a new spot on the map.
              </p>
            ) : null}
          </div>
          <div className="border-t border-slate-100 pt-6">
            <label className="inline-flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={directoryListed}
                disabled={directoryToggleBusy}
                onChange={(e) => void handleDirectoryToggle(e.target.checked)}
              />
              <span className="text-sm text-slate-800">
                <span className="font-medium">Public coach directory</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  Allow your profile to appear in the directory listing.
                </span>
              </span>
            </label>
            {directoryToggleBusy ? (
              <p className="mt-2 text-xs text-slate-500">Updating…</p>
            ) : null}
            {directoryError ? (
              <p className="mt-2 text-sm text-rose-600" role="alert">
                {directoryError}
              </p>
            ) : null}
            <div className="mt-6 space-y-4">
              <OutlinedTextArea
                id="directory_summary"
                label="Directory short summary"
                rows={3}
                value={directorySummary}
                onChange={(e) => setDirectorySummary(e.target.value)}
                wrapperClassName="w-full max-w-lg"
              />
              <p className="-mt-2 max-w-lg text-xs leading-relaxed text-slate-600">
                A brief intro shown on directory cards. Keep it to a few
                sentences.
              </p>
              <OutlinedTextArea
                id="directory_bio"
                label="Directory detailed bio"
                rows={6}
                value={directoryBio}
                onChange={(e) => setDirectoryBio(e.target.value)}
                wrapperClassName="w-full max-w-lg"
              />
              <p className="-mt-2 max-w-lg text-xs leading-relaxed text-slate-600">
                Optional longer copy for your public directory profile page. Leave
                blank to use your short summary there instead.
              </p>
            </div>
          </div>
          <ProfileSecurityFields
            impersonatingCoachId={impersonatingCoachId}
            timezoneIana={profile.timezone ?? null}
            onTimezoneSaved={() => void loadProfile()}
          />
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {saveMessage === "success" ? (
            <span className="text-sm text-green-700">Saved.</span>
          ) : null}
          {saveMessage === "error" && saveError ? (
            <span className="text-sm text-rose-600">{saveError}</span>
          ) : null}
        </div>
      </form>
      ) : null}

      {activeTab === "funnel" ? (
        <FunnelSettingsTab
          appOrigin={appOrigin}
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
          saving={funnelSaving}
          saveMessage={funnelSaveMessage}
          saveError={funnelSaveError}
          onSubmit={(e) => void handleFunnelSave(e)}
        />
      ) : null}

      {activeTab === "workspace" ? (
      <form
        onSubmit={handleWorkspaceSave}
        className="flex w-full flex-col gap-8"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            AI context (your brain)
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            The in-app AI coach reads this into every reply (along with playbook
            excerpts and your{" "}
            <Link
              href={compassHref}
              className="font-medium text-sky-700 underline hover:text-sky-800"
            >
              Compass
            </Link>{" "}
            scores). Edit here or from the AI Coach screen.
          </p>
          <div className="mt-4 max-w-lg space-y-4">
            <OutlinedTextArea
              id="brain_superpowers"
              label="Superpowers"
              rows={4}
              value={brainSuperpowers}
              onChange={(e) => setBrainSuperpowers(e.target.value)}
              placeholder="What you’re uniquely strong at…"
              wrapperClassName="w-full max-w-lg"
            />
            <OutlinedTextArea
              id="brain_hobbies"
              label="Hobbies and recent"
              rows={3}
              value={brainHobbies}
              onChange={(e) => setBrainHobbies(e.target.value)}
              placeholder="Human details you’re happy to weave into content…"
              wrapperClassName="w-full max-w-lg"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">Client results</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Short titles plus outcome stories the model can cite as proof.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {brainClientResults.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                  >
                    <OutlinedTextField
                      id={`brain_client_title_${i}`}
                      label="Title"
                      value={r.title}
                      onChange={(e) => {
                        const next = [...brainClientResults];
                        next[i] = { ...next[i]!, title: e.target.value };
                        setBrainClientResults(next);
                      }}
                      placeholder="Short headline"
                      wrapperClassName="w-full max-w-md"
                    />
                    <div className="mt-3">
                      <OutlinedTextArea
                        id={`brain_client_story_${i}`}
                        label="Outcome / story"
                        rows={3}
                        value={r.story}
                        onChange={(e) => {
                          const next = [...brainClientResults];
                          next[i] = { ...next[i]!, story: e.target.value };
                          setBrainClientResults(next);
                        }}
                        placeholder="Outcome / story"
                        wrapperClassName="w-full max-w-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setBrainClientResults(
                          brainClientResults.filter((_, j) => j !== i)
                        )
                      }
                      className="mt-2 text-xs font-medium text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setBrainClientResults([
                      ...brainClientResults,
                      { title: "", story: "" },
                    ])
                  }
                  className="rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  + Add client result
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={workspaceSaving}
            className="rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {workspaceSaving ? "Saving…" : "Save workspace"}
          </button>
          {workspaceSaveMessage === "success" ? (
            <span className="text-sm text-green-700">Saved.</span>
          ) : null}
          {workspaceSaveMessage === "error" && workspaceSaveError ? (
            <span className="text-sm text-rose-600">{workspaceSaveError}</span>
          ) : null}
        </div>
      </form>
      ) : null}

      <MapLocationPickerModal
        open={mapModalOpen}
        initialLatitude={profile.latitude ?? null}
        initialLongitude={profile.longitude ?? null}
        onClose={() => setMapModalOpen(false)}
        onSave={persistMapPin}
      />
    </>
  );

  if (embed) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-6">{settingsBody}</div>
    );
  }

  return (
    <DashboardPageSection gapClass="gap-6" header={settingsHeader}>
      {settingsBody}
    </DashboardPageSection>
  );
}
