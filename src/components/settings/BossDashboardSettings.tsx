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
import { ProfileAvatarPicker } from "@/components/settings/ProfileAvatarPicker";
import {
  ProfileFieldRow,
  ProfileIdentityCard,
  ProfileMinimalInput,
  ProfileMinimalTextarea,
  ProfileSectionCard,
} from "@/components/settings/ProfileFormLayout";
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
  directory_summary: string | null;
  directory_bio: string | null;
  location: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_geocoded_source?: string | null;
  directory_listed: boolean;
  directory_level: string | null;
};

export type BossDashboardSettingsTabId = "profile" | "ladder";

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
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [directoryListed, setDirectoryListed] = useState(false);
  const [directoryToggleBusy, setDirectoryToggleBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read ?tab= from URL on coach settings
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "funnel") {
      router.replace(
        variant === "admin" ? "/admin/funnel-settings" : "/coach/calls"
      );
      return;
    }
    if (tab === "workspace") {
      if (variant === "admin") {
        router.replace("/admin/message-generator?tab=brain");
      }
      return;
    }
    if (tab === "profile" || tab === "ladder") {
      setInternalTab(tab);
    }
  }, [router, variant]);

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

  const tabDefs: { id: BossDashboardSettingsTabId; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "ladder", label: "My Ladder" },
  ];

  const settingsHeader = (
    <StickyPageHeader
      title="Settings"
      description="Your profile, directory listing, and ladder progress."
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

        <ProfileSectionCard
          title="Profit Coach Directory"
          description={
            <>
              How you appear on the{" "}
              <Link
                href="/directory"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                public coach directory
              </Link>
              .
            </>
          }
        >
          <ProfileFieldRow label="Listed">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={directoryListed}
                disabled={directoryToggleBusy}
                onChange={(e) => void handleDirectoryToggle(e.target.checked)}
              />
              <span className="text-sm text-slate-700">
                Show in the Profit Coach Directory
              </span>
            </label>
            {directoryToggleBusy ? (
              <p className="mt-1 text-[11px] text-slate-500">Updating…</p>
            ) : null}
            {directoryError ? (
              <p className="mt-1 text-sm text-rose-600" role="alert">
                {directoryError}
              </p>
            ) : null}
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Short summary"
            htmlFor="directory_summary"
            alignTop
            hint="A brief intro on directory cards."
          >
            <ProfileMinimalTextarea
              id="directory_summary"
              rows={2}
              value={directorySummary}
              onChange={(e) => setDirectorySummary(e.target.value)}
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Detailed bio"
            htmlFor="directory_bio"
            alignTop
            hint="Optional longer copy for your directory profile page."
            last
          >
            <ProfileMinimalTextarea
              id="directory_bio"
              rows={4}
              value={directoryBio}
              onChange={(e) => setDirectoryBio(e.target.value)}
            />
          </ProfileFieldRow>
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

  return (
    <DashboardPageSection
      gapClass="gap-6"
      header={settingsHeader}
      contentMaxWidthClass={activeTab === "ladder" ? "max-w-6xl" : "max-w-4xl"}
      contentClassName={
        activeTab === "ladder" ? "mx-0 mr-auto w-full" : ""
      }
    >
      {settingsBody}
    </DashboardPageSection>
  );
}
