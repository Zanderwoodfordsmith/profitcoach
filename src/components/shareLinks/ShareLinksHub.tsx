"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AtSign,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  FileText,
  Gauge,
  Globe,
  LayoutDashboard,
  Link2,
  Plus,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { PublicSlugEditor } from "@/components/leadMagnets/PublicSlugEditor";
import { TaggedLinkMaker } from "@/components/shareLinks/TaggedLinkMaker";
import {
  ShareToProspectModal,
  type ShareTarget,
} from "@/components/shareLinks/ShareToProspectModal";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { callsCalendarsHref } from "@/lib/booking/callsCalendarsPath";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { fetchHubQuery, peekHubQuery, writeHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";
import { loadShareHubPayload } from "@/lib/getClients/hubFetchers";
import {
  LEAD_MAGNETS,
  magnetShareCopyUrl,
  magnetShareDisplayUrl,
} from "@/lib/leadMagnets/catalog";
import { coachBookPath } from "@/lib/shareLinks/bookUrl";
import {
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_META,
  type SocialNetwork,
} from "@/lib/shareLinks/socials";
import type {
  CoachCustomLink,
  ShareHubCalendar,
  ShareHubPayload,
} from "@/lib/shareLinks/types";

type SocialDraft = Record<SocialNetwork, string>;

function emptySocialDraft(): SocialDraft {
  return {
    linkedin: "",
    instagram: "",
    facebook: "",
    youtube: "",
    tiktok: "",
    x: "",
    website: "",
  };
}

function prettyUrl(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

const shareClass =
  "shrink-0 text-sm font-semibold text-[#0c5290] transition hover:text-[#051e36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/30 disabled:text-slate-300";
const ghostClass =
  "text-sm font-medium text-slate-500 transition hover:text-slate-800";
const quietInput =
  "w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400";
const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/30 disabled:pointer-events-none disabled:text-slate-300";

/** One group of links (Scorecards, Book a call…) inside the single Links table. */
function LinkSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 first:border-t-0">
      <div className="flex min-h-9 items-center justify-between gap-3 bg-slate-50/70 px-4 py-1.5 sm:px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

/** Icon, name, short description, link, then copy and share. */
function LinkRow({
  icon: Icon,
  title,
  detail,
  displayUrl,
  copied,
  onCopy,
  onShare,
  disabled,
  disabledHint,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  /** Shown in the link column; plain text when there is no single link. */
  displayUrl?: string;
  copied?: boolean;
  onCopy?: () => void;
  onShare?: () => void;
  disabled?: boolean;
  disabledHint?: string;
  trailing?: ReactNode;
}) {
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center sm:gap-6 lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,17rem)]">
        <p className="truncate text-[15px] font-medium text-slate-900">{title}</p>
        <p className="truncate text-sm text-slate-500">{detail}</p>
        <p className="hidden truncate text-sm text-slate-400 lg:block">
          {displayUrl ? prettyUrl(displayUrl) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {trailing}
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            disabled={disabled}
            title={disabled ? disabledHint : copied ? "Copied" : "Copy link"}
            aria-label={copied ? `${title} link copied` : `Copy ${title} link`}
            className={`${iconButton} ${copied ? "text-emerald-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-800"}`}
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          </button>
        ) : null}
        {onShare ? (
          <button
            type="button"
            onClick={onShare}
            disabled={disabled}
            title={disabled ? disabledHint : "Share"}
            aria-label={`Share ${title}`}
            className={`${iconButton} text-[#0c5290] hover:bg-[#0c5290]/10`}
          >
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function LinksSkeleton() {
  return (
    <div className="space-y-4 pb-10 pt-1">
      <div className="ml-auto h-8 w-72 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

export function ShareLinksHub() {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const { impersonatingCoachId } = useImpersonation();
  const cacheKey = hubQueryKey("share", impersonatingCoachId);
  const cached = peekHubQuery<ShareHubPayload>(cacheKey);
  const cachedSocials: SocialDraft | null = cached
    ? {
        ...emptySocialDraft(),
        linkedin: cached.linkedin_url ?? "",
        ...cached.social_links,
      }
    : null;
  const [appOrigin, setAppOrigin] = useState("");
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState(cached?.coach_slug ?? "");
  const [calendars, setCalendars] = useState<ShareHubCalendar[]>(
    () => cached?.calendars ?? []
  );
  const [customLinks, setCustomLinks] = useState<CoachCustomLink[]>(
    () => cached?.custom_links ?? []
  );
  const [socials, setSocials] = useState<SocialDraft>(
    () => cachedSocials ?? emptySocialDraft()
  );
  const [savedSocials, setSavedSocials] = useState<SocialDraft>(
    () => cachedSocials ?? emptySocialDraft()
  );
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);
  const [addingSocial, setAddingSocial] = useState<SocialNetwork | null>(null);
  const [pickingSocial, setPickingSocial] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const authHeaders = useCallback(
    () => getCoachAuthHeaders(impersonatingCoachId),
    [impersonatingCoachId]
  );

  const applySharePayload = useCallback((body: ShareHubPayload) => {
    setSlug(body.coach_slug ?? "");
    setCalendars(body.calendars ?? []);
    setCustomLinks(body.custom_links ?? []);
    const nextSocials: SocialDraft = {
      ...emptySocialDraft(),
      linkedin: body.linkedin_url ?? "",
      ...body.social_links,
    };
    setSocials(nextSocials);
    setSavedSocials(nextSocials);
  }, []);

  const load = useCallback(
    async (force = false) => {
      const hit = peekHubQuery<ShareHubPayload>(cacheKey);
      if (!hit) setLoading(true);
      setError(null);
      try {
        const body = await fetchHubQuery(cacheKey, loadShareHubPayload, {
          force,
        });
        applySharePayload(body);
      } catch (err) {
        if (!hit) {
          setError(
            err instanceof Error ? err.message : "Could not load links."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [applySharePayload, cacheKey]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    writeHubQuery(cacheKey, {
      coach_slug: slug || null,
      linkedin_url: savedSocials.linkedin || null,
      social_links: savedSocials,
      custom_links: customLinks,
      calendars,
    } satisfies ShareHubPayload);
  }, [cacheKey, calendars, customLinks, loading, savedSocials, slug]);

  async function copy(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  }

  const socialsDirty = useMemo(
    () => SOCIAL_NETWORKS.some((network) => socials[network] !== savedSocials[network]),
    [socials, savedSocials]
  );

  async function saveSocials() {
    const headers = await authHeaders();
    if (!headers) return;
    setSocialSaving(true);
    setSocialMessage(null);
    const social_links: Record<string, string> = {};
    for (const network of SOCIAL_NETWORKS) {
      if (network === "linkedin") continue;
      social_links[network] = socials[network];
    }
    const res = await fetch("/api/coach/share-hub/socials", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        linkedin_url: socials.linkedin,
        social_links,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      linkedin_url?: string | null;
      social_links?: Record<string, string>;
    };
    setSocialSaving(false);
    if (!res.ok) {
      setSocialMessage(body.error ?? "Could not save.");
      return;
    }
    const next: SocialDraft = {
      ...emptySocialDraft(),
      linkedin: body.linkedin_url ?? "",
      ...body.social_links,
    };
    setSocials(next);
    setSavedSocials(next);
    setAddingSocial(null);
    setSocialMessage("Saved");
    window.setTimeout(() => setSocialMessage(null), 1800);
  }

  async function addCustomLink() {
    const headers = await authHeaders();
    if (!headers) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/coach/share-hub/custom-links", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: newTitle,
        url: newUrl,
        description: newDescription,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      link?: CoachCustomLink;
    };
    setAdding(false);
    if (!res.ok || !body.link) {
      setAddError(body.error ?? "Could not add that link.");
      return;
    }
    setCustomLinks((prev) => [...prev, body.link!]);
    setNewTitle("");
    setNewUrl("");
    setNewDescription("");
    setAddingCustom(false);
  }

  async function saveCustomEdit(id: string) {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/coach/share-hub/custom-links/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          title: editTitle,
          url: editUrl,
          description: editDescription,
        }),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      link?: CoachCustomLink;
    };
    if (!res.ok || !body.link) {
      setAddError(body.error ?? "Could not update the link.");
      return;
    }
    setCustomLinks((prev) =>
      prev.map((link) => (link.id === id ? body.link! : link))
    );
    setEditingId(null);
  }

  async function deleteCustomLink(id: string) {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/coach/share-hub/custom-links/${encodeURIComponent(id)}`,
      { method: "DELETE", headers }
    );
    if (!res.ok) return;
    setCustomLinks((prev) => prev.filter((link) => link.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const slugReady = slug.trim().length > 0;
  const callsHref = callsCalendarsHref(isAdmin);
  const liveCalendars = calendars.filter((cal) => cal.is_enabled && cal.is_public);
  const offCount = calendars.length - liveCalendars.length;

  const assessmentItems = useMemo(
    () =>
      LEAD_MAGNETS.map((magnet) => {
        const path = magnet.pathForSlug(slug || "your-slug");
        return {
          magnet,
          path,
          displayUrl: magnetShareDisplayUrl(path, "https://theprofitcoach.com"),
          copyUrl: magnetShareCopyUrl(path, appOrigin),
        };
      }),
    [appOrigin, slug]
  );

  const filledSocials = SOCIAL_NETWORKS.filter((network) =>
    socials[network].trim()
  );
  const emptySocials = SOCIAL_NETWORKS.filter(
    (network) => !socials[network].trim()
  );

  if (loading) {
    return <LinksSkeleton />;
  }

  const noSlugHint = "Set your public URL first";
  const editButton =
    "rounded-md px-1.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700";

  return (
    <div className="space-y-4 pb-10 pt-1 selection:bg-[#0c5290]/15">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Copy a link anyone can use, or share one made for one person.
        </p>
        <PublicSlugEditor slug={slug} onSlugChange={setSlug} layout="inline" />
      </div>
      {!slugReady ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set your public URL to share your scorecards and booking pages.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <LinkSection title="Scorecards">
          {assessmentItems.map(({ magnet, copyUrl, displayUrl }) => {
            const isPro = magnet.id === "boss-score-pro";
            const title = isPro ? "Boss Score Pro" : "Boss Score";
            return (
              <LinkRow
                key={magnet.id}
                icon={isPro ? ClipboardList : Gauge}
                title={title}
                detail={
                  isPro
                    ? "Full diagnostic. 50 questions."
                    : "Short scorecard. About 10 minutes."
                }
                displayUrl={displayUrl}
                copied={copiedKey === magnet.id}
                onCopy={() => void copy(magnet.id, copyUrl)}
                onShare={() =>
                  setShareTarget({
                    kind: "assessment",
                    product: isPro ? "boss-pro" : "boss-score",
                    title,
                    genericUrl: copyUrl,
                  })
                }
                disabled={!slugReady}
                disabledHint={noSlugHint}
              />
            );
          })}
        </LinkSection>

        <LinkSection
          title="Book a call"
          action={
            <span className="flex items-center gap-3">
              {offCount > 0 ? (
                <span className="text-xs text-slate-400">{offCount} off</span>
              ) : null}
              <Link href={callsHref} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                Manage in Calls
              </Link>
            </span>
          }
        >
          {liveCalendars.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 sm:px-5">
              No public calendars yet.
            </li>
          ) : (
            liveCalendars.map((calendar) => {
              const path = coachBookPath(slug || "your-slug", calendar.slug);
              const displayUrl = magnetShareDisplayUrl(
                path,
                "https://theprofitcoach.com"
              );
              const copyUrl = magnetShareCopyUrl(path, appOrigin);
              return (
                <LinkRow
                  key={calendar.id}
                  icon={CalendarDays}
                  title={calendar.name}
                  detail={
                    calendar.description?.trim() ||
                    `${calendar.meeting_duration_minutes} minutes`
                  }
                  displayUrl={displayUrl}
                  copied={copiedKey === `cal-${calendar.id}`}
                  onCopy={() => void copy(`cal-${calendar.id}`, copyUrl)}
                  onShare={() =>
                    setShareTarget({
                      kind: "calendar",
                      title: calendar.name,
                      genericUrl: copyUrl,
                    })
                  }
                  disabled={!slugReady}
                  disabledHint={noSlugHint}
                />
              );
            })
          )}
        </LinkSection>

        <LinkSection title="Reports">
          <LinkRow
            icon={FileText}
            title="Boss Score report"
            detail="Send the results page after they finish."
            displayUrl="One per person"
            onShare={() =>
              setShareTarget({
                kind: "report",
                product: "boss-score",
                title: "Boss Score report",
              })
            }
          />
          <LinkRow
            icon={LayoutDashboard}
            title="Boss Score Pro dashboard"
            detail="The workshop dashboard after a Pro session."
            displayUrl="One per person"
            onShare={() =>
              setShareTarget({
                kind: "report",
                product: "boss-pro",
                title: "Boss Score Pro dashboard",
              })
            }
          />
        </LinkSection>

        <LinkSection
          title="Profiles"
          action={
            !addingSocial && emptySocials.length > 0 && !pickingSocial ? (
              <button
                type="button"
                onClick={() => setPickingSocial(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </button>
            ) : null
          }
        >
          {filledSocials.map((network) => {
            const meta = SOCIAL_NETWORK_META[network];
            const value = socials[network].trim();
            return (
              <LinkRow
                key={network}
                icon={network === "website" ? Globe : AtSign}
                title={meta.label}
                detail={prettyUrl(value)}
                copied={copiedKey === `social-${network}`}
                onCopy={() => void copy(`social-${network}`, value)}
                onShare={() =>
                  setShareTarget({
                    kind: "social",
                    network,
                    title: meta.label,
                    genericUrl: value,
                  })
                }
              />
            );
          })}
          {filledSocials.length === 0 && !addingSocial && !pickingSocial ? (
            <li className="px-4 py-3 text-sm text-slate-500 sm:px-5">
              Add your LinkedIn, website or socials to share them from here.
            </li>
          ) : null}
          {pickingSocial && !addingSocial ? (
            <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
              {emptySocials.map((network) => (
                <button
                  key={network}
                  type="button"
                  onClick={() => {
                    setAddingSocial(network);
                    setPickingSocial(false);
                  }}
                  className={ghostClass}
                >
                  {SOCIAL_NETWORK_META[network].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickingSocial(false)}
                className="text-sm text-slate-400 hover:text-slate-700"
              >
                Cancel
              </button>
            </li>
          ) : null}
          {addingSocial ? (
            <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <span className="w-24 text-sm font-medium text-slate-900">
                {SOCIAL_NETWORK_META[addingSocial].label}
              </span>
              <input
                autoFocus
                type="url"
                value={socials[addingSocial]}
                onChange={(e) =>
                  setSocials((prev) => ({
                    ...prev,
                    [addingSocial]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveSocials();
                  }
                  if (e.key === "Escape") {
                    setSocials(savedSocials);
                    setAddingSocial(null);
                  }
                }}
                placeholder={SOCIAL_NETWORK_META[addingSocial].placeholder}
                aria-label={`${SOCIAL_NETWORK_META[addingSocial].label} URL`}
                className={`${quietInput} min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-sky-500 focus:ring-1 focus:ring-sky-500`}
              />
              <button
                type="button"
                onClick={() => void saveSocials()}
                disabled={socialSaving || !socials[addingSocial].trim()}
                className={shareClass}
              >
                {socialSaving ? "Saving" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSocials(savedSocials);
                  setAddingSocial(null);
                }}
                className={ghostClass}
              >
                Cancel
              </button>
            </li>
          ) : null}
          {socialMessage || (socialsDirty && !addingSocial) ? (
            <li className="flex items-center gap-3 px-4 py-2 sm:px-5">
              {socialMessage ? (
                <span
                  className={`text-xs ${
                    socialMessage === "Saved" ? "text-slate-500" : "text-rose-600"
                  }`}
                >
                  {socialMessage}
                </span>
              ) : null}
              {socialsDirty && !addingSocial ? (
                <button
                  type="button"
                  onClick={() => void saveSocials()}
                  disabled={socialSaving}
                  className={shareClass}
                >
                  {socialSaving ? "Saving" : "Save"}
                </button>
              ) : null}
            </li>
          ) : null}
        </LinkSection>

        <LinkSection
          title="Your links"
          action={
            !addingCustom ? (
              <button
                type="button"
                onClick={() => setAddingCustom(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </button>
            ) : null
          }
        >
          {customLinks.map((link) => {
            if (editingId === link.id) {
              return (
                <li key={link.id} className="px-4 py-3 sm:px-5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      aria-label="Title"
                      className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-1.5`}
                    />
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="https://"
                      aria-label="URL"
                      className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-1.5`}
                    />
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                      aria-label="Description"
                      className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-1.5`}
                    />
                  </div>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => void saveCustomEdit(link.id)}
                      className={shareClass}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className={ghostClass}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              );
            }
            return (
              <LinkRow
                key={link.id}
                icon={Link2}
                title={link.title}
                detail={link.description?.trim() || prettyUrl(link.url)}
                displayUrl={link.description?.trim() ? link.url : undefined}
                copied={copiedKey === `custom-${link.id}`}
                onCopy={() => void copy(`custom-${link.id}`, link.url)}
                onShare={() =>
                  setShareTarget({
                    kind: "generic",
                    title: link.title,
                    genericUrl: link.url,
                  })
                }
                trailing={
                  <span className="flex items-center opacity-100 sm:opacity-0 sm:transition sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(link.id);
                        setEditTitle(link.title);
                        setEditUrl(link.url);
                        setEditDescription(link.description ?? "");
                      }}
                      className={editButton}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCustomLink(link.id)}
                      className={editButton}
                    >
                      Delete
                    </button>
                  </span>
                }
              />
            );
          })}
          {customLinks.length === 0 && !addingCustom ? (
            <li className="px-4 py-3 text-sm text-slate-500 sm:px-5">
              Add any other page you send people, like a case study or a workshop.
            </li>
          ) : null}
          {addingCustom ? (
            <li className="px-4 py-3 sm:px-5">
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  aria-label="Title"
                  className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-1.5`}
                />
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://"
                  aria-label="URL"
                  className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-1.5`}
                />
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (optional)"
                  aria-label="Description"
                  className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-1.5`}
                />
              </div>
              {addError ? (
                <p className="mt-2 text-xs text-rose-600">{addError}</p>
              ) : null}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => void addCustomLink()}
                  disabled={adding}
                  className={shareClass}
                >
                  {adding ? "Adding" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCustom(false);
                    setAddError(null);
                  }}
                  className={ghostClass}
                >
                  Cancel
                </button>
              </div>
            </li>
          ) : null}
        </LinkSection>
      </div>

      {slugReady ? (
        <TaggedLinkMaker
          links={[
            ...assessmentItems.map(({ magnet, copyUrl }) => ({
              label: magnet.id === "boss-score-pro" ? "Boss Score Pro" : "Boss Score",
              url: copyUrl,
            })),
            ...liveCalendars.map((calendar) => ({
              label: `Booking: ${calendar.name}`,
              url: magnetShareCopyUrl(coachBookPath(slug, calendar.slug), appOrigin),
            })),
          ]}
        />
      ) : null}

      <ShareToProspectModal
        open={shareTarget != null}
        target={shareTarget}
        coachSlug={slug}
        appOrigin={appOrigin}
        onClose={() => setShareTarget(null)}
      />
    </div>
  );
}
