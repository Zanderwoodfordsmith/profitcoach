"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DashboardPageSection,
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { CallsCalendarSettings } from "@/components/calls/CallsCalendarSettings";
import { GoogleCalendarBookingCard } from "@/components/booking/GoogleCalendarBookingCard";
import { AccountEmailPasswordFields } from "@/components/settings/AccountEmailPasswordFields";
import { BillingSettingsTab } from "@/components/settings/BillingSettingsTab";
import { DirectorySettingsTab } from "@/components/settings/DirectorySettingsTab";
import { FunnelSettingsClient } from "@/components/settings/FunnelSettingsClient";
import { ProfileAvatarPicker } from "@/components/settings/ProfileAvatarPicker";
import {
  ProfileFieldRow,
  ProfileIdentityCard,
  ProfileMinimalInput,
  ProfileMinimalTextarea,
  ProfileSectionCard,
} from "@/components/settings/ProfileFormLayout";
import { ProfileVoiceCard } from "@/components/settings/ProfileVoiceCard";
import { MapLocationPickerModal } from "@/components/settings/MapLocationPickerModal";
import { MyLadderTab } from "@/components/compass/MyLadderTab";
import { notifyAcademyTrackedActionsChanged } from "@/lib/academy/trackedActionsEvents";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type LinkedInImportProfile = {
  linkedinUrl: string;
  scrapedAt: string;
  snapshot: LinkedInProfileSnapshot;
};

type ProfileData = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  bio: string | null;
  community_bio: string | null;
  location: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_geocoded_source?: string | null;
};

export type BossDashboardSettingsTabId =
  | "profile"
  | "billing"
  | "directory"
  | "ladder"
  | "funnel"
  | "calendar";

const SETTINGS_TAB_IDS: BossDashboardSettingsTabId[] = [
  "profile",
  "billing",
  "directory",
  "funnel",
  "calendar",
  "ladder",
];

function parseSettingsTab(
  raw: string | null,
  variant: BossDashboardSettingsProps["variant"]
): BossDashboardSettingsTabId | null {
  if (!raw) return null;
  if (raw === "get-clients") return "funnel";
  if (raw === "billing" && variant !== "coach") return null;
  if (SETTINGS_TAB_IDS.includes(raw as BossDashboardSettingsTabId)) {
    return raw as BossDashboardSettingsTabId;
  }
  return null;
}

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
  const searchParams = useSearchParams();
  const { impersonatingCoachId } = useImpersonation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [communityBio, setCommunityBio] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [linkedinImport, setLinkedinImport] =
    useState<LinkedInImportProfile | null>(null);
  const [linkedinImportLoading, setLinkedinImportLoading] = useState(false);
  const [linkedinImporting, setLinkedinImporting] = useState(false);
  const [linkedinImportError, setLinkedinImportError] = useState<string | null>(
    null
  );

  const [internalTab, setInternalTab] =
    useState<BossDashboardSettingsTabId>("profile");
  const activeTab = embed?.activeTab ?? internalTab;
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [appOrigin, setAppOrigin] = useState("https://theprofitcoach.com");
  const [viewerIsAdmin, setViewerIsAdmin] = useState(variant === "admin");

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
    setFirstName(data.first_name ?? "");
    setLastName(data.last_name ?? "");
    setBusinessName(data.coach_business_name ?? "");
    setLinkedinUrl(data.linkedin_url ?? "");
    setCommunityBio(data.community_bio ?? data.bio ?? "");
    setLocation(data.location ?? "");

    setLinkedinImportLoading(true);
    setLinkedinImportError(null);
    try {
      const liRes = await fetch("/api/coach/linkedin/profile", { headers });
      if (liRes.ok) {
        const liBody = (await liRes.json()) as {
          profile?: LinkedInImportProfile | null;
        };
        setLinkedinImport(liBody.profile ?? null);
      }
    } catch {
      // Non-blocking: profile still loads without prior LinkedIn import.
    } finally {
      setLinkedinImportLoading(false);
    }

    setLoading(false);
  }, [router, impersonatingCoachId, variant]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep Settings tab in sync with ?tab=
    const tab = searchParams.get("tab");
    if (tab === "workspace") {
      if (variant === "admin") {
        router.replace("/admin/message-generator?tab=brain");
      }
      return;
    }
    const parsed = parseSettingsTab(tab, variant);
    if (parsed) {
      setInternalTab(parsed);
    }
  }, [router, variant, searchParams]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      setAppOrigin(window.location.origin);
    }
  }, []);

  const selectTab = useCallback(
    (tab: BossDashboardSettingsTabId) => {
      setInternalTab(tab);
      if (embed) return;
      const href =
        variant === "admin"
          ? `/admin/account?tab=${tab}`
          : `/coach/settings?tab=${tab}`;
      router.replace(href);
    },
    [embed, router, variant]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data bootstrap after async profile-role + coach profile fetches
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (variant === "admin") {
      setViewerIsAdmin(true);
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
        setViewerIsAdmin(roleBody.role === "admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant]);

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
        location: location.trim() || null,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (res.ok) {
      setSaveMessage("success");
      notifyAcademyTrackedActionsChanged();
      void loadProfile();
    } else {
      setSaveMessage("error");
      setSaveError(body.error ?? "Save failed.");
    }
  }

  async function handleLinkedInImport() {
    setLinkedinImportError(null);
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

    setLinkedinImporting(true);
    try {
      const res = await fetch("/api/coach/linkedin/profile", {
        method: "POST",
        headers,
        body: JSON.stringify({
          linkedinUrl: linkedinUrl.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        profile?: LinkedInImportProfile | null;
      };
      if (body.profile) {
        setLinkedinImport(body.profile);
        if (body.profile.linkedinUrl) {
          setLinkedinUrl(body.profile.linkedinUrl);
        }
      }
      if (!res.ok) {
        setLinkedinImportError(
          body.error ?? "Could not import LinkedIn profile."
        );
        return;
      }
      notifyAcademyTrackedActionsChanged();
      // Avatar may have been set from LinkedIn photo when profile had none
      await loadProfile();
    } catch {
      setLinkedinImportError("Could not import LinkedIn profile.");
    } finally {
      setLinkedinImporting(false);
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
    notifyAcademyTrackedActionsChanged();
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
    if (res.ok) {
      notifyAcademyTrackedActionsChanged();
      void loadProfile();
    }
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

  const tabDefs: { id: BossDashboardSettingsTabId; label: string }[] = [
    { id: "profile", label: "Profile" },
    ...(variant === "coach"
      ? [{ id: "billing" as const, label: "Billing" }]
      : []),
    { id: "directory", label: "Directory" },
    { id: "funnel", label: "Get Clients" },
    { id: "calendar", label: "Calendar" },
    { id: "ladder", label: "My Ladder" },
  ];

  const settingsHeader = (
    <StickyPageHeader
      title="Settings"
      description="Profile, billing, directory, Get Clients, calendar, and ladder."
      tabs={
        <PageHeaderUnderlineTabs
          ariaLabel="Settings sections"
          items={tabDefs.map((tab) => ({
            kind: "button" as const,
            id: tab.id,
            label: tab.label,
            active: activeTab === tab.id,
            onClick: () => selectTab(tab.id),
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
        className="flex w-full max-w-2xl flex-col gap-4"
      >
        <ProfileIdentityCard
          firstName={firstName}
          lastName={lastName}
          businessName={businessName}
          location={location}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onBusinessNameChange={setBusinessName}
          onLocationChange={setLocation}
          timezoneIana={profile.timezone ?? null}
          onTimezoneSaved={() => void loadProfile()}
          impersonatingCoachId={impersonatingCoachId}
          hasMapPin={hasMapPin}
          onChangeMapPin={() => setMapModalOpen(true)}
          onClearMapPin={() => void clearMapPin()}
          locationGeocodedManual={
            profile.location_geocoded_source === "manual"
          }
          avatar={
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
              compact
              fieldStyle
            />
          }
        />

        {/* Admin-only until coaches get voice cloning. Hidden on member Profile, including impersonation. */}
        {variant === "admin" && !impersonatingCoachId ? (
          <ProfileVoiceCard
            impersonatingCoachId={impersonatingCoachId}
            profileRevision={`${firstName}|${lastName}|${location}|${profile.full_name ?? ""}`}
          />
        ) : null}

        <ProfileSectionCard title="Community">
          <ProfileFieldRow label="LinkedIn" htmlFor="linkedin_url" alignTop>
            <div className="flex w-full flex-col gap-2">
              <ProfileMinimalInput
                id="linkedin_url"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/yourprofile/"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleLinkedInImport()}
                  disabled={linkedinImporting || !linkedinUrl.trim()}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {linkedinImporting
                    ? "Importing…"
                    : "Import from LinkedIn"}
                </button>
                {linkedinImport?.scrapedAt ? (
                  <span className="text-xs text-slate-500">
                    Last imported{" "}
                    {new Date(linkedinImport.scrapedAt).toLocaleString()}
                  </span>
                ) : linkedinImportLoading ? (
                  <span className="text-xs text-slate-400">Checking…</span>
                ) : null}
              </div>
              {linkedinImportError ? (
                <p className="text-sm text-red-600">{linkedinImportError}</p>
              ) : null}
              {linkedinImport?.snapshot ? (
                <div className="mt-1 flex gap-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
                  {linkedinImport.snapshot.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote LinkedIn CDN URL
                    <img
                      src={linkedinImport.snapshot.photoUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {linkedinImport.snapshot.fullName ??
                        linkedinImport.snapshot.headline ??
                        "LinkedIn profile"}
                    </p>
                    {linkedinImport.snapshot.headline ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                        {linkedinImport.snapshot.headline}
                      </p>
                    ) : null}
                    {linkedinImport.snapshot.about ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {linkedinImport.snapshot.about}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      {linkedinImport.snapshot.experiences.length} experience
                      {linkedinImport.snapshot.experiences.length === 1
                        ? ""
                        : "s"}
                      {linkedinImport.snapshot.featured.length > 0
                        ? ` · ${linkedinImport.snapshot.featured.length} featured`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Bio"
            htmlFor="community_bio"
            alignTop
            hint="Shown in the community roster, sidebar cards, and members map."
            last
          >
            <ProfileMinimalTextarea
              id="community_bio"
              rows={4}
              value={communityBio}
              onChange={(e) => setCommunityBio(e.target.value)}
            />
          </ProfileFieldRow>
        </ProfileSectionCard>

        <ProfileSectionCard title="Account">
          <AccountEmailPasswordFields
            impersonatingCoachId={impersonatingCoachId}
            layout="minimal"
            className="max-w-none"
          />
        </ProfileSectionCard>

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
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

      {activeTab === "directory" ? (
        <DirectorySettingsTab
          variant={variant}
          onEditProfile={() => selectTab("profile")}
        />
      ) : null}

      {activeTab === "billing" && variant === "coach" ? (
        <BillingSettingsTab />
      ) : null}

      {activeTab === "funnel" ? <FunnelSettingsClient embed /> : null}

      {activeTab === "calendar" ? (
        <div className="flex w-full min-w-0 flex-col gap-10">
          {viewerIsAdmin ? (
            <CallsCalendarSettings
              appOrigin={appOrigin}
              callsBasePath={
                variant === "admin" ? "/admin/calls" : "/coach/calls"
              }
            />
          ) : null}
          <Suspense
            fallback={
              <section className="rounded-xl border border-slate-200/80 bg-white p-4">
                <p className="text-sm text-slate-600">Loading integrations…</p>
              </section>
            }
          >
            <GoogleCalendarBookingCard />
          </Suspense>
        </div>
      ) : null}

      {activeTab === "ladder" ? <MyLadderTab /> : null}

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

  const wideTab =
    activeTab === "ladder" ||
    activeTab === "funnel" ||
    activeTab === "calendar" ||
    activeTab === "directory";

  return (
    <DashboardPageSection
      gapClass="gap-6"
      header={settingsHeader}
      contentMaxWidthClass={wideTab ? "max-w-6xl" : "max-w-4xl"}
      contentClassName={wideTab ? "mx-0 mr-auto w-full" : ""}
    >
      {settingsBody}
    </DashboardPageSection>
  );
}
