"use client";

/**
 * Hover a person's name to see who they are and what their company does
 * (23 Nov), so a coach can tell at a glance whether a business is right.
 * Used on Ava's lead list check and the pool; the campaign Prospects card
 * shows the same company part (LeadCompanySection).
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Building2, CalendarDays, Clock, Globe, MapPin, Users } from "lucide-react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import type { LeadCard, LeadCompany } from "@/lib/leads/leadCard";

const CARD_WIDTH = 400;
const OPEN_MS = 450;
const CLOSE_MS = 180;

/** Cards by LinkedIn link, kept for the session across rows and pages. */
const cardCache = new Map<string, LeadCard | null>();

export type LeadHoverPerson = {
  name: string;
  linkedinUrl: string | null;
  /** LinkedIn company id, when the row has it (saves finding it from the cache). */
  companyId?: string | null;
  role?: string | null;
  company?: string | null;
  headline?: string | null;
  location?: string | null;
  industry?: string | null;
  /** Staff band from the search, e.g. "11-50". */
  teamSize?: string | null;
  /** Ava's or the coach's call on them. */
  fit?: { label: string; tone: BadgeTone; why?: string | null } | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}

function siteLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

function siteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

type Fact = { icon: typeof MapPin; text: string };

function Facts({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {facts.map((fact) => (
        <span key={fact.text} className="flex min-w-0 max-w-full items-center gap-1 text-xs text-slate-500">
          <fact.icon className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{fact.text}</span>
        </span>
      ))}
    </div>
  );
}

/** What the company does, its size and where it is. */
export function LeadCompanySection({
  company,
  fallbackName,
  fallbackIndustry,
  fallbackTeamSize,
  loading,
}: {
  company: LeadCompany | null | undefined;
  fallbackName?: string | null;
  fallbackIndustry?: string | null;
  fallbackTeamSize?: string | null;
  loading?: boolean;
}) {
  const name = company?.name || fallbackName;
  const staff =
    company?.employeeCount != null
      ? `${company.employeeCount.toLocaleString("en-GB")} staff on LinkedIn`
      : company?.employeeRange
        ? `${company.employeeRange} staff`
        : fallbackTeamSize
          ? `${fallbackTeamSize} staff`
          : null;
  const facts = [
    company?.industry || fallbackIndustry ? { icon: Building2, text: (company?.industry || fallbackIndustry)! } : null,
    staff ? { icon: Users, text: staff } : null,
    company?.founded ? { icon: CalendarDays, text: `Since ${company.founded}` } : null,
    company?.headOffice ? { icon: MapPin, text: company.headOffice } : null,
  ].filter((f): f is Fact => Boolean(f));

  if (!name && !facts.length && !loading) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {name ? (
        <p className="truncate text-sm font-semibold text-slate-900">
          {company?.profileUrl ? (
            <a href={company.profileUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {name}
            </a>
          ) : (
            name
          )}
        </p>
      ) : null}
      <div className="mt-1">
        <Facts facts={facts} />
      </div>
      {company?.description ? (
        <p className="mt-2 line-clamp-5 whitespace-pre-line text-ui leading-relaxed text-slate-700">{company.description}</p>
      ) : loading ? (
        <div className="mt-2 space-y-1.5" aria-hidden>
          <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      ) : null}
      {company?.website ? (
        <a
          href={siteHref(company.website)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex max-w-full items-center gap-1 text-xs font-medium text-[#0c5290] hover:underline"
        >
          <Globe className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{siteLabel(company.website)}</span>
        </a>
      ) : null}
    </div>
  );
}

/**
 * Wraps a name: after a short hover (or keyboard focus) a white card opens
 * beside it. load() fetches the card once per person; the parent passes its
 * own auth headers.
 */
export function LeadHoverCard({
  person,
  load,
  children,
  className = "min-w-0",
}: {
  person: LeadHoverPerson;
  load: (person: LeadHoverPerson) => Promise<LeadCard | null>;
  children: ReactNode;
  className?: string;
}) {
  const key = person.linkedinUrl || `${person.name}|${person.company ?? ""}`;
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<LeadCard | null | undefined>(() => cardCache.get(key));
  const [photoFailed, setPhotoFailed] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);
  const show = useCallback(() => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setOpen(true), OPEN_MS);
  }, [clearTimers]);
  const hide = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_MS);
  }, [clearTimers]);
  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Fetched once per person on first open. Latest person/load in a ref, so a
  // parent re-render mid-fetch doesn't start another.
  const canLoad = Boolean(person.linkedinUrl || person.companyId);
  const latest = useRef({ person, load });
  useEffect(() => {
    latest.current = { person, load };
  });
  useEffect(() => {
    if (!open || card !== undefined || !canLoad) return;
    const { person: who, load: fetchCard } = latest.current;
    let cancelled = false;
    void fetchCard(who)
      .catch(() => null)
      .then((next) => {
        cardCache.set(key, next);
        if (!cancelled) setCard(next);
      });
    return () => {
      cancelled = true;
    };
  }, [open, card, key, canLoad]);

  // Beside the name, so moving down the list never runs into the card.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(CARD_WIDTH, window.innerWidth - 24);
      let left = rect.right + 12;
      if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
      const top = Math.max(12, Math.min(rect.top - 8, window.innerHeight - 420));
      setPosition({ left, top });
    }
    place();
    window.addEventListener("scroll", place, { capture: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const loading = canLoad && card === undefined;
  const headline = card?.headline || person.headline || [person.role, person.company].filter(Boolean).join(" at ");
  const photoUrl = photoFailed ? null : card?.photoUrl ?? null;
  const personFacts = [
    card?.location || person.location ? { icon: MapPin, text: (card?.location || person.location)! } : null,
    card?.tenure ? { icon: Clock, text: card.tenure } : null,
  ].filter((f): f is Fact => Boolean(f));

  const panel =
    open && position ? (
      <div
        id={panelId}
        role="tooltip"
        className={cardClass("raised", "fixed z-[220] max-h-[calc(100vh-24px)] overflow-y-auto p-4 text-left")}
        style={{ left: position.left, top: position.top, width: Math.min(CARD_WIDTH, window.innerWidth - 24) }}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <div className="flex items-start gap-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- LinkedIn CDN photo, sized here
            <img
              src={photoUrl}
              alt=""
              onError={() => setPhotoFailed(true)}
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d8eee4] text-sm font-semibold text-[#1f5c43] ring-1 ring-inset ring-[#b7dcc8]/90">
              {initials(person.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
            {headline ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{headline}</p> : null}
          </div>
          {person.fit ? <span className={badgeClass(person.fit.tone, "shrink-0")}>{person.fit.label}</span> : null}
        </div>
        {personFacts.length ? (
          <div className="mt-3">
            <Facts facts={personFacts} />
          </div>
        ) : null}
        {card?.about ? (
          <p className="mt-2 line-clamp-4 whitespace-pre-line text-ui leading-relaxed text-slate-700">{card.about}</p>
        ) : null}
        <LeadCompanySection
          company={card?.company}
          fallbackName={person.company}
          fallbackIndustry={person.industry}
          fallbackTeamSize={person.teamSize}
          loading={loading}
        />
        {person.fit?.why ? (
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span className="font-medium text-slate-900">Why: </span>
            {person.fit.why}
          </p>
        ) : null}
        {person.linkedinUrl ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className={buttonClass("second", "small")}>
              <LinkedInSolidIcon className="h-3.5 w-3.5" />
              LinkedIn
            </a>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <span
      ref={triggerRef}
      className={className}
      aria-describedby={open ? panelId : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </span>
  );
}

/** A loader for LeadHoverCard that calls the lead-card API with the page's auth headers. */
export function leadCardLoader(headers: () => Promise<Record<string, string> | null | undefined>) {
  return async (person: LeadHoverPerson): Promise<LeadCard | null> => {
    const qs = new URLSearchParams();
    if (person.linkedinUrl) qs.set("url", person.linkedinUrl);
    if (person.companyId) qs.set("company", person.companyId);
    const res = await fetch(`/api/coach/lead-card?${qs.toString()}`, { headers: (await headers()) ?? {} });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { card?: LeadCard } | null;
    return body?.card ?? null;
  };
}
