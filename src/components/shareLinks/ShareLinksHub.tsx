"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { PublicSlugEditor } from "@/components/leadMagnets/PublicSlugEditor";
import {
  ShareToProspectModal,
  type ShareTarget,
} from "@/components/shareLinks/ShareToProspectModal";
import {
  ContentWithRail,
  ContentWithRailAside,
  ContentWithRailMain,
} from "@/components/layout";
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
  "shrink-0 text-[15px] font-semibold text-[#0c5290] transition hover:text-[#051e36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/30 disabled:text-slate-300";
const ghostClass =
  "text-sm font-medium text-slate-500 transition hover:text-slate-800";
const quietInput =
  "w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400";

function ProductCard({
  title,
  detail,
  displayUrl,
  copied,
  imageSrc,
  imageAlt,
  onCopy,
  onShare,
  disabled,
  footer,
}: {
  title: string;
  detail?: string;
  displayUrl?: string;
  copied?: boolean;
  imageSrc?: string;
  imageAlt?: string;
  onCopy?: () => void;
  onShare?: () => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  return (
    <article className="flex min-h-[132px] w-full flex-col rounded-2xl border border-slate-200 bg-white px-[1.125rem] py-4 text-left shadow-[0_1px_2px_rgb(15_23_42/0.05),0_3px_8px_-3px_rgb(15_23_42/0.08)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold leading-snug tracking-tight text-slate-900">
          {title}
        </h2>
        {onShare ? (
          <button
            type="button"
            onClick={onShare}
            disabled={disabled}
            className={shareClass}
          >
            Share
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex w-full min-w-0 gap-3">
        <div className="min-w-0 flex-1">
          {detail ? (
            <p className="text-base leading-relaxed text-slate-600">{detail}</p>
          ) : null}
          {displayUrl ? (
            onCopy ? (
              <button
                type="button"
                onClick={onCopy}
                className="mt-1 block max-w-full truncate text-left text-sm text-slate-400 transition hover:text-slate-600"
                title="Copy link"
              >
                {copied ? "Copied" : prettyUrl(displayUrl)}
              </button>
            ) : (
              <p className="mt-1 truncate text-sm text-slate-400">
                {prettyUrl(displayUrl)}
              </p>
            )
          ) : null}
          {footer}
        </div>
        {imageSrc ? (
          <div className="relative h-[80px] w-[92px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src={imageSrc}
              alt={imageAlt ?? ""}
              fill
              className="object-cover object-top"
              sizes="92px"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RailCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      {title ? (
        <div className="border-b border-slate-100 px-4 pb-3 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            {title}
          </p>
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  );
}

function RailRow({
  title,
  displayUrl,
  copied,
  onCopy,
  onShare,
  trailing,
}: {
  title: string;
  displayUrl?: string;
  copied?: boolean;
  onCopy?: () => void;
  onShare?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="group flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-semibold leading-snug text-slate-900">
          {title}
        </p>
        {displayUrl ? (
          onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              className="mt-0.5 block max-w-full truncate text-left text-[11px] leading-snug text-slate-500 hover:text-slate-700"
              title="Copy link"
            >
              {copied ? "Copied" : prettyUrl(displayUrl)}
            </button>
          ) : (
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {prettyUrl(displayUrl)}
            </p>
          )
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {trailing}
        {onShare ? (
          <button type="button" onClick={onShare} className={shareClass}>
            Share
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LinksSkeleton() {
  return (
    <ContentWithRail className="pb-10 pt-1">
      <ContentWithRailMain className="flex flex-col gap-6 pt-1">
        <div className="h-[132px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-[132px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-[132px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </ContentWithRailMain>
      <ContentWithRailAside className="lg:top-24">
        <div className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </ContentWithRailAside>
    </ContentWithRail>
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

  return (
    <div className="selection:bg-[#0c5290]/15">
      {error ? (
        <p className="mb-4 text-sm text-rose-600">{error}</p>
      ) : null}

      <ContentWithRail>
        <ContentWithRailMain className="flex min-h-0 flex-col gap-6 pt-1">
          {assessmentItems.map(({ magnet, copyUrl, displayUrl }) => {
            const isPro = magnet.id === "boss-score-pro";
            const title = isPro ? "Boss Score Pro" : "Boss Score";
            return (
              <ProductCard
                key={magnet.id}
                title={title}
                detail={
                  isPro
                    ? "Full diagnostic. 50 questions."
                    : "Short scorecard. About 10 minutes."
                }
                displayUrl={displayUrl}
                copied={copiedKey === magnet.id}
                imageSrc={magnet.imageSrc}
                imageAlt={magnet.imageAlt}
                onCopy={slugReady ? () => void copy(magnet.id, copyUrl) : undefined}
                onShare={
                  slugReady
                    ? () =>
                        setShareTarget({
                          kind: "assessment",
                          product: isPro ? "boss-pro" : "boss-score",
                          title,
                          genericUrl: copyUrl,
                        })
                    : undefined
                }
                disabled={!slugReady}
              />
            );
          })}

          {liveCalendars.length === 0 ? (
            <ProductCard
              title="Book a call"
              detail="No public calendars yet."
              footer={
                <Link href={callsHref} className={`${ghostClass} mt-2 inline-block`}>
                  Manage in Calls
                </Link>
              }
            />
          ) : (
            liveCalendars.map((calendar) => {
              const path = coachBookPath(slug || "your-slug", calendar.slug);
              const displayUrl = magnetShareDisplayUrl(
                path,
                "https://theprofitcoach.com"
              );
              const copyUrl = magnetShareCopyUrl(path, appOrigin);
              return (
                <ProductCard
                  key={calendar.id}
                  title={calendar.name}
                  detail={
                    calendar.description?.trim() ||
                    `${calendar.meeting_duration_minutes} minutes`
                  }
                  displayUrl={displayUrl}
                  copied={copiedKey === `cal-${calendar.id}`}
                  onCopy={
                    slugReady
                      ? () => void copy(`cal-${calendar.id}`, copyUrl)
                      : undefined
                  }
                  onShare={
                    slugReady
                      ? () =>
                          setShareTarget({
                            kind: "calendar",
                            title: calendar.name,
                            genericUrl: copyUrl,
                          })
                      : undefined
                  }
                  disabled={!slugReady}
                  footer={
                    calendar.id === liveCalendars[liveCalendars.length - 1]?.id ? (
                      <span className="mt-2 flex items-center gap-2">
                        <Link href={callsHref} className={`${ghostClass} inline-block`}>
                          Manage in Calls
                        </Link>
                        {offCount > 0 ? (
                          <span className="text-sm text-slate-400">{offCount} off</span>
                        ) : null}
                      </span>
                    ) : null
                  }
                />
              );
            })
          )}

          <ProductCard
            title="Boss Score report"
            detail="Send the results page after they finish."
            onShare={() =>
              setShareTarget({
                kind: "report",
                product: "boss-score",
                title: "Boss Score report",
              })
            }
          />
          <ProductCard
            title="Boss Score Pro dashboard"
            detail="The workshop dashboard after a Pro session."
            onShare={() =>
              setShareTarget({
                kind: "report",
                product: "boss-pro",
                title: "Boss Score Pro dashboard",
              })
            }
          />
        </ContentWithRailMain>

        <ContentWithRailAside className="flex flex-col gap-4 lg:top-24">
          <RailCard>
            <PublicSlugEditor slug={slug} onSlugChange={setSlug} framed={false} />
            <div className="mt-5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Profiles
              </p>
              {filledSocials.map((network) => {
                const meta = SOCIAL_NETWORK_META[network];
                const value = socials[network].trim();
                return (
                  <RailRow
                    key={network}
                    title={meta.label}
                    displayUrl={value}
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
              {addingSocial ? (
                <div className="py-2">
                  <p className="text-[0.8125rem] font-semibold text-slate-900">
                    {SOCIAL_NETWORK_META[addingSocial].label}
                  </p>
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
                    className={`${quietInput} mt-1.5 rounded-lg border border-slate-300 px-2.5 py-2 focus:border-sky-500 focus:ring-1 focus:ring-sky-500`}
                  />
                  <div className="mt-2 flex items-center gap-3">
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
                  </div>
                </div>
              ) : null}
              {!addingSocial && emptySocials.length > 0 ? (
                pickingSocial ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
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
                      className={ghostClass}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickingSocial(true)}
                    className={`${ghostClass} mt-1 inline-flex items-center gap-1.5`}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add a profile
                  </button>
                )
              ) : null}
              {socialMessage ? (
                <p
                  className={`pt-1 text-xs ${
                    socialMessage === "Saved" ? "text-slate-500" : "text-rose-600"
                  }`}
                >
                  {socialMessage}
                </p>
              ) : null}
              {socialsDirty && !addingSocial ? (
                <button
                  type="button"
                  onClick={() => void saveSocials()}
                  disabled={socialSaving}
                  className={`${shareClass} mt-2`}
                >
                  {socialSaving ? "Saving" : "Save"}
                </button>
              ) : null}
            </div>
          </RailCard>

          <RailCard title="Your links">
            {customLinks.map((link) => {
              const editing = editingId === link.id;
              if (editing) {
                return (
                  <div key={link.id} className="space-y-2 py-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      aria-label="Title"
                      className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-2`}
                    />
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="https://"
                      aria-label="URL"
                      className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-2`}
                    />
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                      aria-label="Description"
                      className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-2`}
                    />
                    <div className="flex gap-3 pt-1">
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
                  </div>
                );
              }
              return (
                <RailRow
                  key={link.id}
                  title={link.title}
                  displayUrl={link.url}
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
                    <span className="flex items-center gap-2 opacity-70 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(link.id);
                          setEditTitle(link.title);
                          setEditUrl(link.url);
                          setEditDescription(link.description ?? "");
                        }}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCustomLink(link.id)}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
                      >
                        Delete
                      </button>
                    </span>
                  }
                />
              );
            })}
            {addingCustom ? (
              <div className="space-y-2 py-2">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  aria-label="Title"
                  className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-2`}
                />
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://"
                  aria-label="URL"
                  className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-2`}
                />
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (optional)"
                  aria-label="Description"
                  className={`${quietInput} rounded-lg border border-slate-300 px-2.5 py-2`}
                />
                {addError ? (
                  <p className="text-xs text-rose-600">{addError}</p>
                ) : null}
                <div className="flex gap-3 pt-1">
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
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCustom(true)}
                className={`${ghostClass} mt-1 inline-flex items-center gap-1.5`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add a link
              </button>
            )}
          </RailCard>
        </ContentWithRailAside>
      </ContentWithRail>

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
