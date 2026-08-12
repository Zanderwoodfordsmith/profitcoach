"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Linkedin, MapPin, Pencil, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { DirectoryLevelBadge } from "@/components/directory/DirectoryLevelBadge";
import { notifyAcademyTrackedActionsChanged } from "@/lib/academy/trackedActionsEvents";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type DirectoryProfile = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  directory_summary: string | null;
  directory_bio: string | null;
  location: string | null;
  directory_listed: boolean;
  directory_level: string | null;
  coach_slug: string | null;
};

type LinkedInImport = {
  linkedinUrl: string;
  scrapedAt: string;
  snapshot: LinkedInProfileSnapshot;
};

type Props = {
  variant: "coach" | "admin";
  onEditProfile: () => void;
};

function displayName(p: DirectoryProfile) {
  const fromParts = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return fromParts || p.full_name || p.coach_slug || "Your name";
}

/**
 * Settings → Directory: interactive directory card (LinkedIn-compose style).
 * Uses only directory_summary / directory_bio — never community/legacy bio.
 * Auto-drafts from LinkedIn import when copy is empty.
 */
export function DirectorySettingsTab({
  variant,
  onEditProfile,
}: Props) {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const autoDraftTried = useRef(false);
  const [profile, setProfile] = useState<DirectoryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directorySummary, setDirectorySummary] = useState("");
  const [directoryBio, setDirectoryBio] = useState("");
  const [directoryListed, setDirectoryListed] = useState(false);
  const [directoryToggleBusy, setDirectoryToggleBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | null>(
    null
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBanner, setAiBanner] = useState<string | null>(null);
  const [linkedinImport, setLinkedinImport] = useState<LinkedInImport | null>(
    null
  );
  const [linkedinUrlDraft, setLinkedinUrlDraft] = useState("");
  const [linkedinImporting, setLinkedinImporting] = useState(false);
  const [linkedinImportError, setLinkedinImportError] = useState<string | null>(
    null
  );

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [impersonatingCoachId]);

  const runDirectoryDraft = useCallback(
    async (opts?: { notes?: string; fromLinkedIn?: boolean }) => {
      const headers = await authHeaders();
      if (!headers) return false;

      setAiBusy(true);
      setAiError(null);
      const res = await fetch("/api/coach/directory/draft-copy", {
        method: "POST",
        headers,
        body: JSON.stringify({ notes: opts?.notes?.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        directory_summary?: string;
        directory_bio?: string;
        usedLinkedIn?: boolean;
      };
      setAiBusy(false);
      if (!res.ok) {
        setAiError(body.error ?? "Could not draft copy.");
        return false;
      }
      if (body.directory_summary?.trim()) {
        setDirectorySummary(body.directory_summary.trim());
      }
      if (body.directory_bio?.trim()) {
        setDirectoryBio(body.directory_bio.trim());
        setExpanded(true);
      }
      setSaveMessage(null);
      setAiBanner(
        body.usedLinkedIn || opts?.fromLinkedIn
          ? "Drafted from your LinkedIn import — review and Save."
          : "Draft ready — review and Save."
      );
      return true;
    },
    [authHeaders]
  );

  const load = useCallback(async () => {
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
    if (
      variant === "coach" &&
      roleBody.role === "admin" &&
      !impersonatingCoachId
    ) {
      router.replace("/admin/account?tab=directory");
      return;
    }
    if (variant === "admin" && roleBody.role !== "admin") {
      router.replace("/coach/settings?tab=directory");
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (roleBody.role === "admin" && impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const [res, liRes] = await Promise.all([
      fetch("/api/coach/profile", { headers }),
      fetch("/api/coach/linkedin/profile", { headers }),
    ]);
    if (!res.ok) {
      setError("Could not load directory settings.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as DirectoryProfile;
    setProfile(data);
    setDirectoryListed(!!data.directory_listed);
    setDirectorySummary(data.directory_summary ?? "");
    setDirectoryBio(data.directory_bio ?? "");
    setLinkedinUrlDraft(data.linkedin_url ?? "");
    setDirectoryError(null);

    if (liRes.ok) {
      const liBody = (await liRes.json().catch(() => ({}))) as {
        profile?: LinkedInImport | null;
      };
      setLinkedinImport(liBody.profile ?? null);
    } else {
      setLinkedinImport(null);
    }

    setLoading(false);
  }, [router, impersonatingCoachId, variant]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !profile || autoDraftTried.current) return;
    const empty =
      !directorySummary.trim() && !directoryBio.trim();
    if (!empty || !linkedinImport) return;
    autoDraftTried.current = true;
    void runDirectoryDraft({ fromLinkedIn: true });
  }, [
    loading,
    profile,
    directorySummary,
    directoryBio,
    linkedinImport,
    runDirectoryDraft,
  ]);

  async function handleDirectoryToggle(next: boolean) {
    const headers = await authHeaders();
    if (!headers) return;

    setDirectoryError(null);
    setDirectoryToggleBusy(true);
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
    setProfile((p) => (p ? { ...p, directory_listed: next } : null));
    notifyAcademyTrackedActionsChanged();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);
    setSaveError(null);
    const headers = await authHeaders();
    if (!headers) return;

    setSaving(true);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        directory_summary: directorySummary.trim() || null,
        directory_bio: directoryBio.trim() || null,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (res.ok) {
      setSaveMessage("success");
      setAiBanner(null);
      notifyAcademyTrackedActionsChanged();
      void load();
    } else {
      setSaveMessage("error");
      setSaveError(body.error ?? "Save failed.");
    }
  }

  async function handleAiDraft() {
    await runDirectoryDraft({ notes: aiNotes });
  }

  async function handleLinkedInImport() {
    setLinkedinImportError(null);
    const headers = await authHeaders();
    if (!headers) return;
    const url = linkedinUrlDraft.trim();
    if (!url) {
      setLinkedinImportError("Add your LinkedIn profile URL first.");
      return;
    }

    setLinkedinImporting(true);
    try {
      // Persist URL on profile so Profile + Directory stay in sync.
      await fetch("/api/coach/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ linkedin_url: url }),
      });

      const res = await fetch("/api/coach/linkedin/profile", {
        method: "POST",
        headers,
        body: JSON.stringify({ linkedinUrl: url }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        profile?: LinkedInImport | null;
      };
      if (!res.ok || !body.profile) {
        setLinkedinImportError(
          body.error ?? "Could not import LinkedIn profile."
        );
        return;
      }
      setLinkedinImport(body.profile);
      setProfile((p) => (p ? { ...p, linkedin_url: body.profile!.linkedinUrl } : p));
      autoDraftTried.current = true;
      await runDirectoryDraft({ fromLinkedIn: true });
      void load();
    } catch {
      setLinkedinImportError("Could not import LinkedIn profile.");
    } finally {
      setLinkedinImporting(false);
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

  const name = displayName(profile);
  const slug = profile.coach_slug?.trim() || null;
  const publicHref = slug ? `/directory/${encodeURIComponent(slug)}` : null;

  return (
    <form onSubmit={handleSave} className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Directory listing
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Edit how you appear publicly. Photo, name, and location come from{" "}
            <button
              type="button"
              onClick={onEditProfile}
              className="font-medium text-sky-700 hover:underline"
            >
              Profile
            </button>
            .
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveMessage === "success" ? (
            <span className="text-sm text-green-700">Saved.</span>
          ) : null}
          {saveMessage === "error" && saveError ? (
            <span className="text-sm text-rose-600">{saveError}</span>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {aiBanner ? (
        <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {aiBanner}
        </p>
      ) : null}
      {aiBusy && !aiBanner ? (
        <p className="mb-4 text-sm text-slate-500">
          Drafting your directory copy from LinkedIn…
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div
          className={`relative min-w-0 ${
            expanded ? "max-w-2xl" : "max-w-sm"
          }`}
        >
          {/* Soft stage behind the live card */}
          <div
            className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-slate-100 via-sky-50/80 to-slate-50"
            aria-hidden
          />

          {!expanded ? (
            <>
              <p className="mb-3 text-xs text-slate-500">
                Click{" "}
                <span className="font-semibold text-slate-700">View profile</span>{" "}
                to see what it looks like expanded.
              </p>
              <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- coach avatar URL from storage/CDN
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      No photo — add one in Profile
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm hover:bg-white"
                    title="Edit photo and profile details"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    Photo
                  </button>
                </div>
                <DirectoryLevelBadge level={profile.directory_level} />
                <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {name}
                      </h3>
                      {profile.coach_business_name ? (
                        <p className="text-sm text-slate-600">
                          {profile.coach_business_name}
                        </p>
                      ) : null}
                      {profile.location ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {profile.location}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">
                          Add a location in Profile
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onEditProfile}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                      title="Edit name, business, and location"
                      aria-label="Edit name, business, and location"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="relative rounded-lg bg-slate-50/70 p-2 ring-1 ring-slate-100 focus-within:ring-sky-200">
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <Pencil className="h-3 w-3" aria-hidden />
                      Summary
                    </div>
                    <label className="sr-only" htmlFor="directory_summary_editor">
                      Short summary
                    </label>
                    <textarea
                      id="directory_summary_editor"
                      rows={3}
                      value={directorySummary}
                      onChange={(e) => setDirectorySummary(e.target.value)}
                      placeholder="Write a short directory intro…"
                      className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-600 outline-none placeholder:text-slate-400 focus:ring-0"
                    />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="inline-flex flex-1 justify-center rounded-md bg-sky-700 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-sky-600"
                    >
                      View profile
                    </button>
                    {profile.linkedin_url ? (
                      <span className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
                        LinkedIn
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Expanded profile — edit your full bio here.
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  ← Back to card
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                <div className="relative aspect-[16/9] w-full bg-slate-100">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- coach avatar URL from storage/CDN
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      No photo
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm hover:bg-white"
                    title="Edit photo and profile details"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    Photo
                  </button>
                </div>
                <DirectoryLevelBadge level={profile.directory_level} />
                <div className="space-y-5 px-6 py-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-2xl font-bold text-slate-900">{name}</h3>
                      {profile.coach_business_name ? (
                        <p className="mt-1 text-lg text-slate-600">
                          {profile.coach_business_name}
                        </p>
                      ) : null}
                      {profile.location ? (
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                          {profile.location}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={onEditProfile}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                      title="Edit name, business, and location"
                      aria-label="Edit name, business, and location"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100 focus-within:ring-sky-200">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <Pencil className="h-3 w-3" aria-hidden />
                      Card summary
                    </p>
                    <label className="sr-only" htmlFor="directory_summary_expanded">
                      Short summary
                    </label>
                    <textarea
                      id="directory_summary_expanded"
                      rows={2}
                      value={directorySummary}
                      onChange={(e) => setDirectorySummary(e.target.value)}
                      placeholder="Short intro on the directory card…"
                      className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-600 outline-none placeholder:text-slate-400 focus:ring-0"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-50/50 p-3 ring-1 ring-slate-100 focus-within:ring-sky-200">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <Pencil className="h-3 w-3" aria-hidden />
                      Full bio
                    </p>
                    <label className="sr-only" htmlFor="directory_bio_editor">
                      Detailed bio
                    </label>
                    <textarea
                      id="directory_bio_editor"
                      rows={8}
                      value={directoryBio}
                      onChange={(e) => setDirectoryBio(e.target.value)}
                      placeholder="Tell prospects who you help and how…"
                      className="w-full resize-y border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 focus:ring-0"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <span className="inline-flex cursor-default items-center justify-center rounded-md bg-sky-700/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
                      Get started
                    </span>
                    {profile.linkedin_url ? (
                      <span className="inline-flex cursor-default items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800">
                        LinkedIn
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Visibility
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={directoryListed}
              disabled={directoryToggleBusy}
              onClick={() => void handleDirectoryToggle(!directoryListed)}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left ring-1 ring-slate-100 transition hover:bg-slate-100/80 disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  Show in directory
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {directoryToggleBusy
                    ? "Updating…"
                    : directoryListed
                      ? "Publicly listed"
                      : "Currently hidden"}
                </span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  directoryListed ? "bg-sky-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    directoryListed ? "left-5" : "left-0.5"
                  }`}
                />
              </span>
            </button>
            {directoryError ? (
              <p className="mt-2 text-sm text-rose-600" role="alert">
                {directoryError}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              LinkedIn
            </p>
            {linkedinImport ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-2.5">
                  {linkedinImport.snapshot.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- LinkedIn CDN
                    <img
                      src={linkedinImport.snapshot.photoUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A66C2]/10 text-[#0A66C2]">
                      <Linkedin className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {linkedinImport.snapshot.fullName ?? "Imported"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Imported{" "}
                      {new Date(linkedinImport.scrapedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  We use this to draft your directory summary and bio.
                </p>
                <button
                  type="button"
                  disabled={linkedinImporting || aiBusy}
                  onClick={() => void handleLinkedInImport()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  {linkedinImporting ? "Importing…" : "Re-import LinkedIn"}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-600">
                  Import your LinkedIn profile so we can draft your directory
                  copy for you.
                </p>
                <label className="sr-only" htmlFor="directory_linkedin_url">
                  LinkedIn profile URL
                </label>
                <input
                  id="directory_linkedin_url"
                  type="url"
                  value={linkedinUrlDraft}
                  onChange={(e) => setLinkedinUrlDraft(e.target.value)}
                  placeholder="https://www.linkedin.com/in/…"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                />
                <button
                  type="button"
                  disabled={linkedinImporting || !linkedinUrlDraft.trim()}
                  onClick={() => void handleLinkedInImport()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0A66C2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:opacity-60"
                >
                  <Linkedin className="h-3.5 w-3.5" aria-hidden />
                  {linkedinImporting
                    ? "Importing…"
                    : "Import LinkedIn profile"}
                </button>
                {!linkedinUrlDraft.trim() ? (
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="w-full text-center text-xs font-medium text-sky-700 hover:underline"
                  >
                    Or add your URL in Profile
                  </button>
                ) : null}
              </div>
            )}
            {linkedinImportError ? (
              <p className="mt-2 text-sm text-rose-600" role="alert">
                {linkedinImportError}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Writing help
            </p>
            {!aiOpen ? (
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Help me write
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <label className="block text-xs text-slate-500" htmlFor="directory_ai_notes">
                  Optional notes (who you help, outcomes, tone)
                </label>
                <textarea
                  id="directory_ai_notes"
                  rows={4}
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="e.g. I help UK manufacturers get from stuck growth to a clear profit plan…"
                  className="w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                />
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => void handleAiDraft()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {aiBusy ? "Drafting…" : "Draft summary & bio"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiOpen(false);
                    setAiError(null);
                  }}
                  className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
                {aiError ? (
                  <p className="text-sm text-rose-600" role="alert">
                    {aiError}
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Fills both the card summary and full bio. Edit anything before
                    you save.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Links
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/directory"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Browse directory
              </Link>
              {publicHref && directoryListed ? (
                <Link
                  href={publicHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Your public page
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onEditProfile}
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Edit profile details
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
