"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DashboardPageSection,
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { AccountEmailPasswordFields } from "@/components/settings/AccountEmailPasswordFields";
import { AccountSettingsCard } from "@/components/settings/AccountSettingsCard";
import { ProfileAvatarPicker } from "@/components/settings/ProfileAvatarPicker";
import {
  OutlinedTextArea,
  OutlinedTextField,
} from "@/components/settings/OutlinedFormField";
import { MapLocationPickerModal } from "@/components/settings/MapLocationPickerModal";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
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
  /** HTML snippet used to render a booking calendar on assessment results. */
  calendar_embed_code?: string | null;
  /** Allowlisted keys; eyebrow overrides BOSS landing hero line. */
  landing_copy_overrides?: Record<string, string> | null;
  /** Default funnel variant when share link has no ?variant= or cookie. */
  landing_variant_preference?: "a" | "b" | "c" | "d" | null;
};

export type BossDashboardSettingsTabId =
  | "profile"
  | "account"
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
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [leadWebhookUrl, setLeadWebhookUrl] = useState("");
  const [calendarEmbedCode, setCalendarEmbedCode] = useState("");
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
  const [landingVariantPref, setLandingVariantPref] = useState<"" | "a" | "b" | "c" | "d">("");

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
    setBio(data.bio ?? "");
    setLocation(data.location ?? "");
    setLeadWebhookUrl(data.lead_webhook_url ?? "");
    setCalendarEmbedCode(data.calendar_embed_code ?? "");
    setLandingEyebrow(data.landing_copy_overrides?.eyebrow ?? "");
    const pref = data.landing_variant_preference;
    setLandingVariantPref(
      pref === "a" || pref === "b" || pref === "c" || pref === "d" ? pref : ""
    );
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data bootstrap after async profile-role + coach profile fetches
    void loadProfile();
  }, [loadProfile]);

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
        bio: bio.trim() || null,
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
        lead_webhook_url: leadWebhookUrl.trim() || null,
        calendar_embed_code: calendarEmbedCode.trim() || null,
        landing_copy_overrides: landingEyebrow.trim()
          ? { eyebrow: landingEyebrow.trim() }
          : {},
        landing_variant_preference:
          landingVariantPref === "" ? null : landingVariantPref,
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
    { id: "account", label: "Account" },
    { id: "funnel", label: "Funnel" },
    { id: "workspace", label: "Workspace" },
  ];

  const settingsHeader = (
    <StickyPageHeader
      title="Settings"
      description="Profile, account, funnel links, and workspace."
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
      {activeTab === "account" ? (
        <AccountSettingsCard
          impersonatingCoachId={impersonatingCoachId}
          timezoneIana={profile.timezone ?? null}
          onTimezoneSaved={() => void loadProfile()}
          showEmailPassword={false}
        />
      ) : null}

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
              id="bio"
              label="Bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              wrapperClassName="w-full max-w-lg"
            />
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
          </div>
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
        <form
          onSubmit={handleFunnelSave}
          className="flex w-full flex-col gap-8"
        >
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Score link</h2>
            {profile.coach_slug ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Prospects open{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                    /score/{profile.coach_slug}
                  </code>{" "}
                  (your coach slug in the URL path).
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <a
                    className="font-medium text-sky-700 underline hover:text-sky-900"
                    href={`/score/${encodeURIComponent(profile.coach_slug)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Add{" "}
                  <code className="rounded bg-slate-50 px-1">?company=</code> or{" "}
                  <code className="rounded bg-slate-50 px-1">?prospect=</code> for
                  one-off links. Preview other layouts from{" "}
                  <code className="rounded bg-slate-50 px-1">/landing/a</code>
                  {" "}through{" "}
                  <code className="rounded bg-slate-50 px-1">/landing/d</code> with{" "}
                  <code className="rounded bg-slate-50 px-1">?coach=</code>.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-amber-800">
                You need a coach slug before you can share a score link.
              </p>
            )}
            <div className="mt-6 max-w-lg space-y-4">
              <OutlinedTextField
                id="landing_eyebrow"
                label="Hero eyebrow (version B only)"
                value={landingEyebrow}
                onChange={(e) => setLandingEyebrow(e.target.value)}
                placeholder="e.g. For engineering founders, £500K–£5M"
                wrapperClassName="w-full max-w-lg"
              />
              <div>
                <label
                  htmlFor="landing_variant_pref"
                  className="block text-sm font-medium text-slate-700"
                >
                  Default version (not applied to /score while it opens D only)
                </label>
                <select
                  id="landing_variant_pref"
                  className="mt-1.5 block w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={landingVariantPref}
                  onChange={(e) =>
                    setLandingVariantPref(
                      e.target.value === "a" ||
                        e.target.value === "b" ||
                        e.target.value === "c" ||
                        e.target.value === "d"
                        ? e.target.value
                        : ""
                    )
                  }
                >
                  <option value="">No preference</option>
                  <option value="a">Always A</option>
                  <option value="b">Always B</option>
                  <option value="c">Always C</option>
                  <option value="d">Always D (same as C, split hero)</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Booking on results page
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Optional embed after the assessment. Leave blank to hide.
            </p>
            <div className="mt-4 max-w-3xl">
              <OutlinedTextArea
                id="calendar_embed_code"
                label="Embed HTML"
                rows={8}
                value={calendarEmbedCode}
                onChange={(e) => setCalendarEmbedCode(e.target.value)}
                placeholder='<iframe src="https://..." …></iframe>'
                wrapperClassName="w-full max-w-3xl"
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Lead webhook</h2>
            <p className="mt-1 text-sm text-slate-600">
              Optional. We POST when we get an email and again with the score — same
              URL; dedupe on <code className="text-xs">contact_id</code>.
            </p>
            <div className="mt-4 max-w-lg">
              <OutlinedTextField
                id="lead_webhook_url"
                label="HTTPS URL"
                type="url"
                value={leadWebhookUrl}
                onChange={(e) => setLeadWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                wrapperClassName="w-full max-w-lg"
              />
            </div>
          </section>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={funnelSaving}
              className="rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {funnelSaving ? "Saving…" : "Save funnel"}
            </button>
            {funnelSaveMessage === "success" ? (
              <span className="text-sm text-green-700">Saved.</span>
            ) : null}
            {funnelSaveMessage === "error" && funnelSaveError ? (
              <span className="text-sm text-rose-600">{funnelSaveError}</span>
            ) : null}
          </div>
        </form>
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
