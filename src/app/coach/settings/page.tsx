"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
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
  coach_slug: string | null;
  directory_listed: boolean;
  directory_level: string | null;
};

export default function CoachSettingsPage() {
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
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [directoryListed, setDirectoryListed] = useState(false);
  const [directoryLevel, setDirectoryLevel] = useState<string | null>(null);
  const [directoryToggleBusy, setDirectoryToggleBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

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
    const effectiveId =
      roleBody.role === "admin" && impersonatingCoachId
        ? impersonatingCoachId
        : session.user.id;
    if (roleBody.role === "admin" && !impersonatingCoachId) {
      router.replace("/admin");
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
    setDirectoryLevel(data.directory_level ?? null);
    setDirectoryError(null);
    setFirstName(data.first_name ?? "");
    setLastName(data.last_name ?? "");
    setBusinessName(data.coach_business_name ?? "");
    setLinkedinUrl(data.linkedin_url ?? "");
    setBio(data.bio ?? "");
    setLocation(data.location ?? "");
    setLoading(false);
  }, [router, impersonatingCoachId]);

  useEffect(() => {
    let cancelled = false;
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  async function handleSave(e: React.FormEvent) {
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

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const prospectLink =
    profile?.coach_slug && origin
      ? `${origin}/landing/a?coach=${encodeURIComponent(profile.coach_slug)}`
      : "";

  function copyProspectLink() {
    if (prospectLink && navigator.clipboard) {
      navigator.clipboard.writeText(prospectLink);
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

  const levelLabel =
    directoryLevel === "certified"
      ? "Certified"
      : directoryLevel === "professional"
        ? "Professional"
        : directoryLevel === "elite"
          ? "Elite"
          : null;

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (!profile) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Settings"
        description="Profile, photo, prospect link, and directory visibility."
      />

      <form
        onSubmit={handleSave}
        className="flex w-full flex-col gap-8"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="first_name"
                className="block text-sm font-medium text-slate-700"
              >
                First name
              </label>
              <input
                id="first_name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label
                htmlFor="last_name"
                className="block text-sm font-medium text-slate-700"
              >
                Last name
              </label>
              <input
                id="last_name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <label
              htmlFor="business_name"
              className="block text-sm font-medium text-slate-700"
            >
              Business name
            </label>
            <input
              id="business_name"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="mt-4">
            <label
              htmlFor="linkedin_url"
              className="block text-sm font-medium text-slate-700"
            >
              LinkedIn profile URL
            </label>
            <input
              id="linkedin_url"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/yourprofile/"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="mt-4">
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-slate-700"
            >
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="mt-4">
            <label
              htmlFor="location"
              className="block text-sm font-medium text-slate-700"
            >
              Location
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. London, UK"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Photo</h2>
          <div className="mt-4 flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-24 w-24 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                No photo
              </div>
            )}
            <div>
              <label className="block">
                <span className="sr-only">Upload photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-sky-700"
                />
              </label>
              <p className="mt-1 text-xs text-slate-500">
                JPEG, PNG or WebP. Max 2MB.
              </p>
              {uploadingAvatar && (
                <p className="mt-1 text-xs text-slate-600">Uploading…</p>
              )}
              {avatarError && (
                <p className="mt-1 text-xs text-rose-600">{avatarError}</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Public directory
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            When enabled, your profile can appear in the public coach directory.
            Your certification level is assigned by an administrator.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={directoryListed}
                disabled={directoryToggleBusy}
                onChange={(e) => void handleDirectoryToggle(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-800">
                Show my profile in the public directory
              </span>
            </label>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Certification level:{" "}
            <span className="font-medium text-slate-900">
              {levelLabel ?? "Not set yet"}
            </span>
          </p>
          {directoryToggleBusy ? (
            <p className="mt-2 text-xs text-slate-500">Updating…</p>
          ) : null}
          {directoryError ? (
            <p className="mt-2 text-sm text-rose-600" role="alert">
              {directoryError}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Public listing still requires your profile to meet directory guidelines.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Prospect link
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Share this link with prospects. When they complete the assessment,
            their results are stored under your account.
          </p>
          {profile.coach_slug ? (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Your slug
                </p>
                <p className="mt-0.5 font-mono text-sm text-slate-900">
                  {profile.coach_slug}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Your prospect link
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-sky-700">
                    {prospectLink}
                  </span>
                  <button
                    type="button"
                    onClick={copyProspectLink}
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                You can add <code className="rounded bg-slate-100 px-1">?coach=YOUR_SLUG</code> to
                the assessment or landing URL to attribute prospects to you.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Ask an admin to set your coach slug to get a prospect link.
            </p>
          )}
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {saveMessage === "success" && (
            <span className="text-sm text-green-700">Saved.</span>
          )}
          {saveMessage === "error" && saveError && (
            <span className="text-sm text-rose-600">{saveError}</span>
          )}
        </div>
      </form>
    </div>
  );
}
