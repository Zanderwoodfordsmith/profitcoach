"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  CreditCard,
  Gauge,
  Globe,
  GraduationCap,
  Info,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
  Presentation,
  Users,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

import { membershipPageCopy as copy } from "@/content/membershipPageCopy";
import {
  isEmbeddedRequest,
  navigateTopWindow,
  useEmbedAutoResize,
  useEmbedTopNavigation,
} from "@/lib/embedMode";
import {
  formatMembershipPrice,
  MEMBERSHIP_PLANS,
  type MembershipInterval,
  type MembershipPlanKey,
} from "@/config/membershipPlans";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  marketingAssetPublicUrl,
  MEMBERSHIP_CONFERENCE_VIDEO_PATH,
  MEMBERSHIP_HERO_VIDEO_PATH,
} from "@/lib/marketingAssets";
import { supabaseClient } from "@/lib/supabaseClient";

type PlanInfo = {
  key: MembershipPlanKey;
  tier: string;
  label: string;
  description: string;
  monthlyPriceGbp: number;
  annualPriceGbp: number;
  checkoutAvailable: { month: boolean; year: boolean };
  isCurrent: boolean;
  relation: "upgrade" | "downgrade" | "current";
};

type MembershipPayload = {
  adminPreview?: boolean;
  publicView?: boolean;
  tier: string;
  tierLabel: string;
  subscription: {
    status: string | null;
    interval: MembershipInterval | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  needsPaymentChoice: boolean;
  plans: PlanInfo[];
  stripeConfigured: boolean;
  recurringPaymentStatus: string | null;
  recurringActive?: boolean;
};

const RECURRING_LABELS: Record<string, string> = {
  monthly: "Monthly",
  annual_prepaid: "Annual prepaid",
  first_6_months: "1st 6 months",
  complimentary: "Complimentary",
  overdue: "Overdue",
};

/* Profit Coach design tokens (colors_and_type.css) */
const CHATHAMS = "#0c5290";
const CHATHAMS_DEEP = "#063056";
const VELOCITY = "#42a1ee";
const GO = "#10b981";
const GO_DEEP = "#059669";
const CANVAS = "#f5f8fc";
const HERO_GRADIENT =
  "radial-gradient(ellipse 90% 70% at 50% -25%, rgba(66,161,238,0.45), transparent 65%), linear-gradient(165deg, #073157 0%, #0c5290 55%, #1664b6 120%)";
const BRAND_GRADIENT = `linear-gradient(135deg, ${CHATHAMS} 0%, ${CHATHAMS_DEEP} 100%)`;
const GO_GRADIENT = `linear-gradient(135deg, ${GO}, ${GO_DEEP})`;
const GO_SHADOW = "0 16px 34px -12px rgba(16,185,129,0.45)";
const MONO = "var(--font-pc-ds-mono), ui-monospace, 'SF Mono', Menlo, monospace";

const HIGHLIGHT_PLAN: MembershipPlanKey = "premium";
/** Column index of the highlighted tier in the comparison table (0 = feature names). */
const HIGHLIGHT_COLUMN = 2;
const TABLE_COLS = "30% 23.333% 23.333% 23.334%";

const FEATURE_BLOCK_ICONS: Record<string, LucideIcon> = {
  "Brand and Profile": Globe,
  Classroom: GraduationCap,
  Community: Users,
  "Monthly Momentum Call": CalendarDays,
  "Weekly Coaching and Implementation Calls": CalendarRange,
  "BOSS and Profit Tools": Gauge,
  "CRM and Connector": Link2,
  "Profit Coach Conferences": Presentation,
  "1:1 Coaching": PhoneCall,
  "WhatsApp Access": MessageCircle,
};

/** Maps a comparison-table row label to its feature block (for the info modal). */
const ROW_TO_FEATURE_BLOCK: Record<string, string> = {
  "Brand and Profile": "Brand and Profile",
  Classroom: "Classroom",
  Community: "Community",
  "Monthly calls": "Monthly Momentum Call",
  "Weekly calls": "Weekly Coaching and Implementation Calls",
  "BOSS & Profit tools": "BOSS and Profit Tools",
  "CRM & Connector": "CRM and Connector",
  Conferences: "Profit Coach Conferences",
  "1:1 coaching": "1:1 Coaching",
  "WhatsApp access": "WhatsApp Access",
};

const COMPARISON_ROW_ICONS: Record<string, LucideIcon> = {
  "Brand and Profile": Globe,
  Classroom: GraduationCap,
  Community: Users,
  "Monthly calls": CalendarDays,
  "Weekly calls": CalendarRange,
  "BOSS & Profit tools": Gauge,
  "CRM & Connector": Link2,
  Conferences: Presentation,
  "1:1 coaching": PhoneCall,
  "WhatsApp access": MessageCircle,
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function WhatsAppButton({
  light,
  showLabel = true,
  className = "",
}: {
  light?: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={copy.helpContact.whatsAppHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110 ${
        light
          ? "border border-white/25 bg-[#25D366] text-white hover:bg-[#20bd5a]"
          : "bg-[#25D366] text-white shadow-sm hover:bg-[#20bd5a]"
      } ${className}`}
      aria-label="Chat with us on WhatsApp"
    >
      <WhatsAppIcon className="h-4 w-4 shrink-0" />
      {showLabel ? <span>WhatsApp</span> : null}
    </Link>
  );
}

function HelpContact({
  light,
  compact = true,
  stacked = false,
  align = "left",
  label,
  className = "",
}: {
  light?: boolean;
  compact?: boolean;
  stacked?: boolean;
  align?: "left" | "right";
  label?: string;
  className?: string;
}) {
  const labelClass = light ? "text-white/55" : "text-slate-400";
  const linkClass = light
    ? "font-medium text-white/90 transition hover:text-white"
    : "font-medium text-slate-700 transition hover:text-slate-900";

  if (stacked) {
    return (
      <div
        className={`flex flex-col gap-1.5 text-xs sm:text-sm ${
          align === "right" ? "items-end text-right" : ""
        } ${className}`}
      >
        <span className={`font-semibold uppercase tracking-[0.12em] ${labelClass}`}>
          {label ?? copy.helpContact.label}
        </span>
        <Link href={copy.helpContact.emailHref} className={`inline-flex items-center gap-1.5 ${linkClass}`}>
          <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          {copy.helpContact.email}
        </Link>
        <Link href={copy.helpContact.phoneHref} className={`inline-flex items-center gap-1.5 ${linkClass}`}>
          <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          {copy.helpContact.phone}
        </Link>
        <WhatsAppButton light={light} showLabel={false} className="px-2.5 py-1.5" />
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:gap-x-3 sm:text-sm ${
          align === "right" ? "justify-end" : ""
        } ${className}`}
      >
        <span className={`shrink-0 font-semibold uppercase tracking-[0.12em] ${labelClass}`}>
          {label ?? copy.helpContact.label}
        </span>
        <Link href={copy.helpContact.phoneHref} className={`inline-flex items-center gap-1.5 ${linkClass}`}>
          <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          {copy.helpContact.phone}
        </Link>
        <Link
          href={copy.helpContact.emailHref}
          className={`inline-flex items-center gap-1.5 ${linkClass}`}
        >
          <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          {copy.helpContact.email}
        </Link>
      </div>
    );
  }

  const lineClass = light ? "text-white/75" : "text-slate-600";

  return (
    <div className={`text-sm leading-snug ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${labelClass}`}>
        {label ?? copy.helpContact.label}
      </p>
      <p className={`mt-1.5 ${lineClass}`}>
        <Link href={copy.helpContact.phoneHref} className={`inline-flex items-center gap-1.5 ${linkClass}`}>
          <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          {copy.helpContact.phoneLine}
        </Link>
      </p>
      <div className="mt-2">
        <WhatsAppButton light={light} />
      </div>
      <Link
        href={copy.helpContact.emailHref}
        className={`mt-1 inline-flex items-center gap-1.5 ${linkClass}`}
      >
        <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {copy.helpContact.email}
      </Link>
    </div>
  );
}

function Eyebrow({ light, children }: { light?: boolean; children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase"
      style={{ letterSpacing: "0.28em", color: light ? "#a8d4ff" : CHATHAMS }}
    >
      {children}
    </p>
  );
}

function authHeaders(impersonatingCoachId: string | null) {
  return async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  };
}

function formatRenewalDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: string | null, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return "Canceling";
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    default:
      return status ?? "None";
  }
}

function scrollToPlans() {
  document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });
}

const MEMBERSHIP_HERO_VIDEO_SRC = marketingAssetPublicUrl(MEMBERSHIP_HERO_VIDEO_PATH);
const MEMBERSHIP_HERO_VIDEO_POSTER = "/membership/bca-membership-video-poster.jpg";
const MEMBERSHIP_CTA_VIDEO_SRC = marketingAssetPublicUrl(MEMBERSHIP_CONFERENCE_VIDEO_PATH);
const MEMBERSHIP_CTA_VIDEO_POSTER = "/membership/bca-conference-walk-around-poster.png";

function MembershipVideoPlayer({
  src,
  poster,
  playLabel,
  className = "relative h-full min-h-[380px] w-full",
}: {
  src: string;
  poster?: string;
  playLabel: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  function handleStart() {
    setHasStarted(true);
    void videoRef.current?.play();
  }

  return (
    <div className={className}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={hasStarted}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        onPlay={() => setHasStarted(true)}
      />
      {!hasStarted && (
        <button
          type="button"
          onClick={handleStart}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 transition hover:bg-black/30"
          aria-label={playLabel}
        >
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill={CHATHAMS} aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <p className="px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {playLabel}
          </p>
        </button>
      )}
    </div>
  );
}

function MembershipConferenceVideo() {
  return (
    <MembershipVideoPlayer
      src={MEMBERSHIP_CTA_VIDEO_SRC}
      poster={MEMBERSHIP_CTA_VIDEO_POSTER}
      playLabel="BCA conference walk around"
    />
  );
}

type CoachListRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

function coachDisplayName(c: CoachListRow): string {
  return c.full_name?.trim() || c.coach_business_name?.trim() || c.slug || "Coach";
}

/** Collapsible admin FAB — hidden until expanded so the page demos cleanly. */
function AdminPreviewCoachPicker({
  situation,
  className = "",
}: {
  situation?: string[] | null;
  className?: string;
}) {
  const { impersonatingCoachId, setImpersonatingCoachId } = useImpersonation();
  const [panelOpen, setPanelOpen] = useState(false);
  const [coachPickerOpen, setCoachPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coaches, setCoaches] = useState<CoachListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((c) =>
      [c.full_name, c.coach_business_name, c.slug]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [coaches, query]);

  async function loadCoaches() {
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setLoadError("Not signed in.");
        return;
      }
      const res = await fetch("/api/admin/coaches", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        coaches?: CoachListRow[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(body.error ?? "Could not load coaches.");
        return;
      }
      const list = body.coaches ?? [];
      list.sort((a, b) =>
        coachDisplayName(a).localeCompare(coachDisplayName(b), undefined, {
          sensitivity: "base",
        })
      );
      setCoaches(list);
    } finally {
      setLoading(false);
    }
  }

  function handleToggleCoachPicker() {
    if (coachPickerOpen) {
      setCoachPickerOpen(false);
      return;
    }
    setCoachPickerOpen(true);
    setQuery("");
    void loadCoaches();
  }

  useEffect(() => {
    if (!coachPickerOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setCoachPickerOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCoachPickerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [coachPickerOpen]);

  return (
    <div ref={rootRef} className={`fixed bottom-4 right-4 z-[99] sm:bottom-5 sm:right-5 ${className}`}>
      {panelOpen && (
        <div className="absolute bottom-[calc(100%+10px)] right-0 w-[min(19rem,calc(100vw-2rem))]">
          {coachPickerOpen && (
            <div className="mb-2 rounded-lg border border-amber-400/80 bg-white py-2 shadow-lg ring-1 ring-black/5">
              <div className="px-2 pb-2">
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or slug…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500"
                  aria-label="Filter coaches"
                />
              </div>
              <div className="max-h-56 overflow-y-auto px-1">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </div>
                ) : loadError ? (
                  <p className="px-2 py-2 text-xs text-rose-600">{loadError}</p>
                ) : filtered.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-slate-500">
                    {coaches.length === 0 ? "No coaches found." : "No matches."}
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setImpersonatingCoachId(c.id);
                            setCoachPickerOpen(false);
                          }}
                          className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                            c.id === impersonatingCoachId
                              ? "bg-amber-100 text-amber-950"
                              : "text-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          <span className="font-medium leading-tight">{coachDisplayName(c)}</span>
                          <span className="mt-0.5 font-mono text-[10px] text-slate-400">{c.slug}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <div className="rounded-lg border border-amber-300/90 bg-amber-50 shadow-lg">
            <button
              type="button"
              onClick={handleToggleCoachPicker}
              className="w-full px-3 py-2 text-left text-[11px] font-semibold text-amber-950 transition hover:bg-amber-100"
              aria-expanded={coachPickerOpen}
              aria-haspopup="listbox"
            >
              Admin preview · View as coach {coachPickerOpen ? "▴" : "▾"}
            </button>
            {situation && situation.length > 0 && (
              <div className="space-y-1 border-t border-amber-200/80 px-3 py-2">
                {situation.map((line) => (
                  <p key={line} className="text-[10px] leading-snug text-amber-900/90">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setPanelOpen((prev) => {
            if (prev) setCoachPickerOpen(false);
            return !prev;
          });
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/90 bg-amber-100 text-amber-950 shadow-lg ring-1 ring-black/5 transition hover:bg-amber-200"
        aria-label={panelOpen ? "Close admin preview" : "Open admin preview"}
        aria-expanded={panelOpen}
      >
        {panelOpen ? <X className="h-5 w-5" /> : <Users className="h-5 w-5" />}
      </button>
    </div>
  );
}

function FeatureSectionLabel({ title, first }: { title: string; first?: boolean }) {
  return (
    <div className={`col-span-full flex items-center gap-4 ${first ? "mb-2" : "mt-10 mb-2"}`}>
      <p
        className="shrink-0 text-[12px] font-semibold uppercase text-slate-500"
        style={{ letterSpacing: "0.12em" }}
      >
        {title}
      </p>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function FeatureBlockCard({
  eyebrow,
  headline,
  description,
}: {
  eyebrow: string;
  headline: string;
  description: string;
}) {
  const BlockIcon = FEATURE_BLOCK_ICONS[eyebrow] ?? Check;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: BRAND_GRADIENT }}
        >
          <BlockIcon className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
        <p
          className="text-[11px] font-bold uppercase"
          style={{ letterSpacing: "0.16em", color: CHATHAMS }}
        >
          {eyebrow}
        </p>
      </div>
      <h3
        className="mt-4 text-xl font-bold text-slate-900"
        style={{ letterSpacing: "-0.01em" }}
      >
        {headline}
      </h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200/80">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-start justify-between gap-6 py-5 text-left"
        aria-expanded={open}
      >
        <span
          className={`text-[15px] font-medium leading-snug transition-colors sm:text-base ${
            open ? "text-slate-900" : "text-slate-800 group-hover:text-slate-900"
          }`}
        >
          {q}
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180 text-slate-600" : "group-hover:text-slate-500"
          }`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="space-y-3 pb-5">
          {a.split("\n\n").map((para) => (
            <p key={para.slice(0, 24)} className="text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureInfoPopover({
  feature,
  anchorEl,
  onPointerEnter,
  onPointerLeave,
}: {
  feature: string;
  anchorEl: HTMLElement;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    top: number;
    left: number;
    arrowTop: number;
    arrowSide: "left" | "right";
  } | null>(null);
  const [fadedIn, setFadedIn] = useState(false);

  const blockEyebrow = ROW_TO_FEATURE_BLOCK[feature] ?? feature;
  const block = copy.featureBlocks.find((b) => b.eyebrow === blockEyebrow);
  const BlockIcon = FEATURE_BLOCK_ICONS[blockEyebrow] ?? Check;

  useLayoutEffect(() => {
    setFadedIn(false);

    function computePosition() {
      const popoverEl = popoverRef.current;
      if (!popoverEl) return;

      const rect = anchorEl.getBoundingClientRect();
      const popoverWidth = 320;
      const popoverHeight = popoverEl.offsetHeight;
      const gap = 12;
      const viewportPad = 16;

      let left = rect.right + gap;
      let arrowSide: "left" | "right" = "left";
      if (left + popoverWidth > window.innerWidth - viewportPad) {
        left = rect.left - popoverWidth - gap;
        arrowSide = "right";
      }

      const anchorMidY = rect.top + rect.height / 2;
      let top = anchorMidY - popoverHeight / 2;
      top = Math.max(
        viewportPad,
        Math.min(top, window.innerHeight - popoverHeight - viewportPad),
      );

      const arrowTop = Math.min(
        Math.max(anchorMidY - top, 28),
        popoverHeight - 28,
      );

      setLayout({ top, left, arrowTop, arrowSide });
    }

    computePosition();
    const raf = requestAnimationFrame(computePosition);
    window.addEventListener("scroll", computePosition, true);
    window.addEventListener("resize", computePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", computePosition, true);
      window.removeEventListener("resize", computePosition);
    };
  }, [anchorEl, feature]);

  useEffect(() => {
    if (!layout) return;
    const id = requestAnimationFrame(() => setFadedIn(true));
    return () => cancelAnimationFrame(id);
  }, [layout]);

  if (!block) return null;

  const show = Boolean(layout && fadedIn);

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-slate-950/65 backdrop-blur-[1px] pointer-events-none transition-opacity duration-[350ms] ease-out"
        style={{ opacity: show ? 1 : 0 }}
        aria-hidden
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={block.eyebrow}
        className="fixed z-[131] w-[320px] rounded-2xl bg-white px-6 py-7 shadow-2xl transition-opacity duration-[350ms] ease-out"
        style={
          layout
            ? { top: layout.top, left: layout.left, visibility: "visible", opacity: show ? 1 : 0 }
            : { top: -9999, left: -9999, visibility: "hidden", opacity: 0 }
        }
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
        onClick={(e) => e.stopPropagation()}
      >
        {layout &&
          (layout.arrowSide === "left" ? (
            <span
              className="absolute -left-2 h-0 w-0 -translate-y-1/2"
              style={{
                top: layout.arrowTop,
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderRight: "8px solid white",
              }}
            />
          ) : (
            <span
              className="absolute -right-2 h-0 w-0 -translate-y-1/2"
              style={{
                top: layout.arrowTop,
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderLeft: "8px solid white",
              }}
            />
          ))}
        <div className="text-center">
          <span
            className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            <BlockIcon className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <h3
            className="mt-3 text-[17px] font-bold text-slate-900"
            style={{ letterSpacing: "-0.01em" }}
          >
            {block.eyebrow}
          </h3>
          <p className="mt-1.5 text-[13.5px] font-semibold leading-snug" style={{ color: CHATHAMS }}>
            {block.headline}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{block.description}</p>
        </div>
      </div>
    </>
  );
}

export function MembershipPageClient() {
  const searchParams = useSearchParams();
  const isEmbedded = isEmbeddedRequest(searchParams);
  useEmbedAutoResize(isEmbedded);
  useEmbedTopNavigation(isEmbedded);
  const { impersonatingCoachId } = useImpersonation();
  const [data, setData] = useState<MembershipPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionCheckout, setActionCheckout] = useState<{
    plan: MembershipPlanKey;
    interval: MembershipInterval;
  } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoFeature, setInfoFeature] = useState<string | null>(null);
  const [infoAnchorEl, setInfoAnchorEl] = useState<HTMLElement | null>(null);
  const infoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openFeatureInfo = useCallback((feature: string, el: HTMLElement) => {
    if (infoCloseTimerRef.current) clearTimeout(infoCloseTimerRef.current);
    setInfoFeature(feature);
    setInfoAnchorEl(el);
  }, []);

  const scheduleCloseFeatureInfo = useCallback(() => {
    if (infoCloseTimerRef.current) clearTimeout(infoCloseTimerRef.current);
    infoCloseTimerRef.current = setTimeout(() => {
      setInfoFeature(null);
      setInfoAnchorEl(null);
    }, 200);
  }, []);

  const cancelCloseFeatureInfo = useCallback(() => {
    if (infoCloseTimerRef.current) clearTimeout(infoCloseTimerRef.current);
  }, []);

  const closeFeatureInfo = useCallback(() => {
    if (infoCloseTimerRef.current) clearTimeout(infoCloseTimerRef.current);
    setInfoFeature(null);
    setInfoAnchorEl(null);
  }, []);

  useEffect(() => {
    if (!infoFeature) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeFeatureInfo();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [infoFeature, closeFeatureInfo]);

  const getHeaders = authHeaders(impersonatingCoachId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = await getHeaders();
    const res = await fetch("/api/coach/membership", { headers });
    const body = (await res.json().catch(() => ({}))) as MembershipPayload & {
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load membership.");
      setData(null);
    } else {
      setData(body);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impersonatingCoachId]);

  useEffect(() => {
    void load();
  }, [load]);

  const success = searchParams.get("success") === "1";
  const updated = searchParams.get("updated") === "1";

  async function startCheckout(plan: MembershipPlanKey, interval: MembershipInterval) {
    setActionCheckout({ plan, interval });
    setError(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/coach/membership", {
        method: "POST",
        headers,
        body: JSON.stringify({ plan, interval }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Checkout failed.");
        return;
      }
      navigateTopWindow(body.url);
    } catch {
      setError("Checkout failed.");
    } finally {
      setActionCheckout(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/coach/membership/portal", {
        method: "POST",
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not open billing portal.");
        return;
      }
      navigateTopWindow(body.url);
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  const tierCards: MembershipPlanKey[] = ["core", "premium", "vip"];
  const hasSubscription = Boolean(data?.subscription.status);
  const isAdminPreview = Boolean(data?.adminPreview);
  const inFirstSixMonths =
    !hasSubscription && data?.recurringPaymentStatus === "first_6_months";
  const isComplimentary =
    !hasSubscription && data?.recurringPaymentStatus === "complimentary";
  const needsChoice = Boolean(data?.needsPaymentChoice);
  const legacyRecurring =
    !hasSubscription &&
    Boolean(data?.recurringActive) &&
    !inFirstSixMonths &&
    !isComplimentary;
  const statusOverlap =
    !loading && data && !isAdminPreview && (hasSubscription || legacyRecurring);

  // Admin-facing summary of the impersonated coach's situation and what the page shows them.
  const adminSituation: string[] | null =
    impersonatingCoachId && data && !isAdminPreview
      ? [
          `Tier: ${data.tierLabel}`,
          `Billing: ${
            hasSubscription
              ? `Stripe subscription (${statusLabel(data.subscription.status, data.subscription.cancelAtPeriodEnd)}${
                  data.subscription.currentPeriodEnd
                    ? `, renews ${formatRenewalDate(data.subscription.currentPeriodEnd)}`
                    : ""
                })`
              : data.recurringPaymentStatus
                ? `${RECURRING_LABELS[data.recurringPaymentStatus] ?? data.recurringPaymentStatus} (outside Stripe subscriptions)`
                : data.recurringActive
                  ? "recurring payments detected in payment history (no status set, outside Stripe subscriptions)"
                  : "none on record"
          }`,
          `Page shows: ${
            hasSubscription
              ? `"You're on ${data.tierLabel}" strip; their plan is marked Current`
              : inFirstSixMonths
                ? '"first 6 months. Nothing to do yet." banner'
                : isComplimentary
                  ? "complimentary banner"
                  : legacyRecurring
                    ? "existing-arrangement banner; join buttons would move them to self-serve Stripe billing"
                    : needsChoice
                      ? 'amber "choose a plan" banner'
                      : "plans only, no banner"
          }`,
        ]
      : null;

  return (
    <div
      className={isEmbedded ? "w-full" : "min-h-screen w-full"}
      style={{ backgroundColor: CANVAS, color: "#0f172a" }}
    >
      {(isAdminPreview || Boolean(impersonatingCoachId)) && (
        <AdminPreviewCoachPicker situation={adminSituation} />
      )}
      {/* Feature info popover (Chess.com-style) */}
      {infoFeature && infoAnchorEl && (
        <FeatureInfoPopover
          feature={infoFeature}
          anchorEl={infoAnchorEl}
          onPointerEnter={cancelCloseFeatureInfo}
          onPointerLeave={scheduleCloseFeatureInfo}
        />
      )}
      {/* ---------- Hero band ---------- */}
      <div className="relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
        {/* Top bar */}
        <div className="relative z-10 mx-auto max-w-[1200px] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Image
              src="/brand/profit-coach-logo-white.svg"
              alt="Profit Coach"
              width={187}
              height={40}
              className="-ml-[11px] h-[2.2rem] w-auto shrink-0 sm:-ml-[15px] sm:h-[2.475rem]"
              priority
            />
            <div className="flex flex-wrap items-center gap-3 sm:justify-end sm:gap-5">
              <HelpContact light />
              <WhatsAppButton light />
              {hasSubscription && (
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Manage billing
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hero content — text left, video right */}
        <div className="relative z-10 mx-auto grid max-w-[1200px] items-center gap-12 px-6 pb-24 pt-10 sm:px-8 sm:pb-28 sm:pt-14 lg:grid-cols-2">
          <div>
            <Eyebrow light>Profit Coach Membership</Eyebrow>
            <h1
              className="mt-6 max-w-2xl font-light text-white"
              style={{
                fontSize: "clamp(2.25rem, 4vw, 3.5rem)",
                letterSpacing: "-0.035em",
                lineHeight: 1.08,
              }}
            >
              Keep your system on. <strong className="font-bold">Choose your pace.</strong>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              {copy.hero.subheadline}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={scrollToPlans}
                className="group inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[15px] font-semibold text-white transition hover:brightness-110"
                style={{ background: GO_GRADIENT, boxShadow: GO_SHADOW }}
              >
                {copy.hero.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
            <p className="mt-6 text-sm font-medium text-white/55">
              Switch or cancel anytime · Managed securely through Stripe
            </p>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-2xl backdrop-blur">
            <MembershipVideoPlayer
              src={MEMBERSHIP_HERO_VIDEO_SRC}
              poster={MEMBERSHIP_HERO_VIDEO_POSTER}
              playLabel="Watch: how membership works"
              className="relative h-full w-full"
            />
          </div>
        </div>
      </div>

      {/* Current plan / billing status — compact card overlapping hero */}
      {statusOverlap && (
        <div className="relative z-20 mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="-mt-10 sm:-mt-12">
            {hasSubscription ? (
              <div className="mx-auto flex max-w-lg items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg sm:px-6 sm:py-5">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">
                    You&apos;re on {data!.tierLabel}
                    <span className="ml-1.5 font-normal text-slate-500">
                      · {statusLabel(data!.subscription.status, data!.subscription.cancelAtPeriodEnd)}
                    </span>
                  </p>
                  {data!.subscription.currentPeriodEnd && (
                    <p className="text-[13px] text-slate-500 sm:text-sm">
                      {data!.subscription.cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
                      {formatRenewalDate(data!.subscription.currentPeriodEnd)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-xl items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg sm:px-6 sm:py-5">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">
                    You&apos;re on {data!.tierLabel}. Billed under an existing arrangement
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500 sm:text-sm">
                    Nothing to do. To move to self‑serve billing, choose a level below.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={`mx-auto max-w-[1200px] px-6 sm:px-8 ${statusOverlap ? "pt-8 sm:pt-10" : "pt-12 sm:pt-16"}`}
      >
        {(success || updated) && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
            {success
              ? "Membership updated. Thank you. Your access will sync within a few moments."
              : "Plan change submitted. Your billing will update shortly."}
          </div>
        )}
        {/* Situation banners for coaches without a subscription */}
        {!loading && data && !isAdminPreview && inFirstSixMonths && (
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: BRAND_GRADIENT }}
            >
              <Check className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-slate-900">
                You&apos;re still in your first 6 months. Nothing to do yet.
              </p>
              <p className="text-sm text-slate-500">
                Membership starts when your build phase ends. You&apos;re welcome to
                choose your level in advance so the handover is seamless.
              </p>
            </div>
          </div>
        )}
        {!loading && data && !isAdminPreview && isComplimentary && (
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: BRAND_GRADIENT }}
            >
              <Check className="h-5 w-5" />
            </span>
            <p className="text-[15px] font-semibold text-slate-900">
              Your membership is complimentary. No payment needed.
            </p>
          </div>
        )}
        {!loading && data && !isAdminPreview && !hasSubscription && needsChoice && (
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-amber-950">
                You don&apos;t have an active membership yet.
              </p>
              <p className="text-sm text-amber-900/80">
                Choose a level below to keep your system, tools and community access live.
              </p>
            </div>
          </div>
        )}

        {/* ---------- Plans ---------- */}
        <section
          id="plans"
          className={`scroll-mt-10 pb-20 sm:pb-28 ${statusOverlap ? "pt-6 sm:pt-7" : "pt-10 sm:pt-14"}`}
        >
          <div className="text-center">
            <Eyebrow>Membership levels</Eyebrow>
            <h2
              className="mx-auto mt-2.5 max-w-xl font-light text-slate-900"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", letterSpacing: "-0.02em", lineHeight: 1.12 }}
            >
              Choose the level that matches <strong className="font-bold">how fast you want to grow.</strong>
            </h2>
          </div>

          <div className="relative mx-auto mt-[55px] max-w-[1020px] px-2.5 pt-4">
            {/* Most popular — sits above Premium column */}
            <div
              className="pointer-events-none absolute top-0 z-10 grid w-full"
              style={{ gridTemplateColumns: TABLE_COLS }}
            >
              <div />
              <div />
              <div className="flex justify-center">
                <span
                  className="rounded-full px-4 py-1.5 text-[10px] font-bold uppercase text-white shadow-md"
                  style={{ background: GO_GRADIENT, letterSpacing: "0.14em" }}
                >
                  Most popular
                </span>
              </div>
              <div />
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm" style={{ tableLayout: "fixed" }}>
                  <thead>
                    {/* Tier names */}
                    <tr>
                      <th style={{ width: "30%" }} />
                      {tierCards.map((key, i) => {
                        const isPremiumCol = i + 1 === HIGHLIGHT_COLUMN;
                        return (
                          <th
                            key={key}
                            className={`px-5 pb-2.5 text-center ${isPremiumCol ? "pt-7" : "pt-6"}`}
                            style={{
                              width: "23.333%",
                              ...(isPremiumCol ? { backgroundColor: "#eaf2fb" } : {}),
                            }}
                          >
                            <span
                              className="text-[1.375rem] font-bold text-slate-900"
                              style={{ letterSpacing: "-0.01em" }}
                            >
                              {copy.tiers[key].name}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                    {/* Taglines */}
                    <tr>
                      <th />
                      {tierCards.map((key, i) => {
                        const isPremiumCol = i + 1 === HIGHLIGHT_COLUMN;
                        return (
                          <th
                            key={key}
                            className="px-5 pb-2 pt-2 text-center text-[14.5px] font-semibold leading-snug"
                            style={{
                              color: CHATHAMS,
                              ...(isPremiumCol ? { backgroundColor: "#eaf2fb" } : {}),
                            }}
                          >
                            {copy.tiers[key].tagline}
                          </th>
                        );
                      })}
                    </tr>
                    {/* Who it's for */}
                    <tr>
                      <th />
                      {tierCards.map((key, i) => {
                        const isPremiumCol = i + 1 === HIGHLIGHT_COLUMN;
                        return (
                          <th
                            key={key}
                            className="px-5 pb-2 text-center text-[14px] font-normal leading-snug text-slate-600"
                            style={isPremiumCol ? { backgroundColor: "#eaf2fb" } : undefined}
                          >
                            {copy.tiers[key].chooseIf}
                          </th>
                        );
                      })}
                    </tr>
                    {/* Feature column label */}
                    <tr className="border-b border-slate-200">
                      <th
                        className="px-6 py-2.5 text-left text-[11px] font-bold uppercase text-slate-400"
                        style={{ letterSpacing: "0.12em" }}
                      >
                        Feature
                      </th>
                      {tierCards.map((key, i) => {
                        const isPremiumCol = i + 1 === HIGHLIGHT_COLUMN;
                        return (
                          <th
                            key={key}
                            className="py-2.5"
                            style={isPremiumCol ? { backgroundColor: "#eaf2fb" } : undefined}
                          />
                        );
                      })}
                    </tr>
                  </thead>
                <tbody>
                  {copy.comparison.rows.map((row, ri) => {
                    const RowIcon = COMPARISON_ROW_ICONS[row[0]] ?? Check;
                    return (
                      <tr
                        key={ri}
                        className={ri % 2 === 1 ? "bg-[#f5f8fc]" : undefined}
                      >
                        {row.map((cell, ci) => {
                          const isPremiumCol = ci === HIGHLIGHT_COLUMN;
                          return (
                            <td
                              key={ci}
                              className={`px-6 py-4 text-[14.5px] ${
                                ci === 0
                                  ? "min-w-[240px] whitespace-nowrap text-left font-semibold text-slate-800"
                                  : "text-center text-slate-600"
                              }`}
                              style={isPremiumCol ? { backgroundColor: "#eaf2fb" } : undefined}
                            >
                              {ci === 0 ? (
                                <span
                                  data-feature-label
                                  className="flex items-center gap-3"
                                >
                                  <span
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                                    style={{ background: BRAND_GRADIENT }}
                                  >
                                    <RowIcon className="h-4 w-4" strokeWidth={2.25} />
                                  </span>
                                  <span className="inline-flex min-w-0 items-center gap-1.5">
                                    <span className="whitespace-nowrap leading-none">{cell}</span>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      onMouseEnter={(e) => openFeatureInfo(row[0], e.currentTarget)}
                                      onMouseLeave={scheduleCloseFeatureInfo}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (infoFeature === row[0]) closeFeatureInfo();
                                        else openFeatureInfo(row[0], e.currentTarget);
                                      }}
                                      className="inline-flex shrink-0 items-center justify-center self-center border-0 bg-transparent p-0 text-slate-400 outline-none transition-colors hover:text-slate-600"
                                      aria-label={`About ${row[0]}`}
                                    >
                                      <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
                                    </button>
                                  </span>
                                </span>
                              ) : cell === "✓" ? (
                                isPremiumCol ? (
                                  <span
                                    className="mx-auto inline-flex h-[22px] w-[22px] items-center justify-center rounded-full"
                                    style={{ backgroundColor: GO }}
                                  >
                                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
                                  </span>
                                ) : (
                                  <Check
                                    className="mx-auto h-[22px] w-[22px]"
                                    strokeWidth={3}
                                    style={{ color: GO }}
                                  />
                                )
                              ) : cell === "✗" ? (
                                <X
                                  className="mx-auto h-[18px] w-[18px] text-slate-300"
                                  strokeWidth={2.75}
                                />
                              ) : (
                                cell
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="px-6 py-6 align-middle">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-slate-600">Pay yearly</span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: "rgba(16,185,129,0.12)", color: GO_DEEP }}
                        >
                          Save 2 months
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-snug text-slate-400">
                        Annual option at checkout
                      </p>
                    </td>
                    {tierCards.map((key, i) => {
                      const isPremiumCol = i + 1 === HIGHLIGHT_COLUMN;
                      const tierCopy = copy.tiers[key];
                      const plan = MEMBERSHIP_PLANS[key];
                      const planInfo = data?.plans.find((p) => p.key === key);
                      const subInterval = data?.subscription.interval;
                      const isCurrentTier = Boolean(planInfo?.isCurrent);
                      const isCurrentMonthly = isCurrentTier && subInterval === "month";
                      const isCurrentAnnual = isCurrentTier && subInterval === "year";
                      const monthlyCheckoutOk = planInfo?.checkoutAvailable.month;
                      const checkoutBusy = actionCheckout !== null;
                      const monthlyLoading =
                        actionCheckout?.plan === key && actionCheckout.interval === "month";

                      const actionLabel = isCurrentMonthly
                        ? "Current plan"
                        : isCurrentAnnual
                          ? "Switch to monthly"
                          : planInfo?.relation === "upgrade"
                            ? `Upgrade to ${tierCopy.name}`
                            : planInfo?.relation === "downgrade"
                              ? `Switch to ${tierCopy.name}`
                              : `Join ${tierCopy.name}`;

                      return (
                        <td
                          key={key}
                          className="px-4 py-6 text-center align-middle"
                          style={isPremiumCol ? { backgroundColor: "#eaf2fb" } : undefined}
                        >
                          {data?.stripeConfigured && !isAdminPreview ? (
                            <button
                              type="button"
                              disabled={
                                !monthlyCheckoutOk || checkoutBusy || isCurrentMonthly
                              }
                              onClick={() => void startCheckout(key, "month")}
                              className={`inline-flex w-full max-w-[180px] flex-col items-center justify-center gap-0.5 rounded-full px-4 py-3 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                isPremiumCol ? "text-white hover:brightness-110" : "hover:shadow-sm"
                              }`}
                              style={
                                isPremiumCol
                                  ? { background: GO_GRADIENT, boxShadow: GO_SHADOW }
                                  : {
                                      backgroundColor: "#fff",
                                      border: "1px solid #e2e8f0",
                                      color: CHATHAMS,
                                    }
                              }
                            >
                              {monthlyLoading ? (
                                <span className="inline-flex items-center gap-2 text-[13.5px] font-semibold">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Redirecting…
                                </span>
                              ) : (
                                <>
                                  <span className="text-[13.5px] font-semibold leading-tight">
                                    {actionLabel}
                                  </span>
                                  <span
                                    className={`text-[12px] font-medium leading-tight ${
                                      isPremiumCol ? "text-white/75" : "text-slate-500"
                                    }`}
                                    style={{ fontFamily: MONO, letterSpacing: "-0.01em" }}
                                  >
                                    {formatMembershipPrice(plan.monthlyPriceGbp)}/mo
                                  </span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="mx-auto inline-flex max-w-[180px] flex-col items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-3">
                              <span className="text-[12.5px] font-medium text-slate-400">
                                {isAdminPreview ? "Admin preview" : "Coming soon"}
                              </span>
                              <span
                                className="mt-0.5 text-[12px] font-medium text-slate-500"
                                style={{ fontFamily: MONO }}
                              >
                                {formatMembershipPrice(plan.monthlyPriceGbp)}/mo
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          </div>
          {error && (
            <div className="mx-auto mt-6 max-w-[1020px] rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
              {error}
            </div>
          )}
        </section>
      </div>

      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        {/* ---------- Feature blocks ---------- */}
        <section className="pt-2 sm:pt-6">
          <div className="text-center">
            <Eyebrow>What each one gives you</Eyebrow>
            <h2
              className="mt-2.5 font-light text-slate-900"
              style={{ fontSize: "clamp(1.625rem, 2.6vw, 2.25rem)", letterSpacing: "-0.02em" }}
            >
              Every feature, and <strong className="font-bold">why it matters.</strong>
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {copy.featureBlockSections.map((section, sectionIndex) => {
              const blocks = section.blockEyebrows
                .map((eyebrow) => copy.featureBlocks.find((b) => b.eyebrow === eyebrow))
                .filter((block): block is (typeof copy.featureBlocks)[number] => Boolean(block));

              return (
                <Fragment key={section.title}>
                  <FeatureSectionLabel title={section.title} first={sectionIndex === 0} />
                  {blocks.map((block) => (
                    <FeatureBlockCard
                      key={block.eyebrow}
                      eyebrow={block.eyebrow}
                      headline={block.headline}
                      description={block.description}
                    />
                  ))}
                </Fragment>
              );
            })}
          </div>
          <div className="mt-12 flex flex-col items-center gap-2.5 text-center sm:mt-14">
            <button
              type="button"
              onClick={scrollToPlans}
              className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110"
              style={{ background: GO_GRADIENT, boxShadow: GO_SHADOW }}
            >
              {copy.hero.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <p className="text-sm text-slate-500">Switch or cancel anytime</p>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="mt-14 py-14 sm:mt-16 sm:py-16">
          <div className="text-center">
            <Eyebrow>Questions</Eyebrow>
            <h2
              className="mt-2.5 font-light text-slate-900"
              style={{ fontSize: "clamp(1.625rem, 2.6vw, 2.25rem)", letterSpacing: "-0.02em" }}
            >
              Frequently asked <strong className="font-bold">questions.</strong>
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-[600px] border-t border-slate-200/80">
            {copy.faq.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </section>

        {/* ---------- Final CTA (split card) ---------- */}
        <section className="mt-[30px] pb-24 sm:pb-28">
          <div
            className="grid overflow-hidden rounded-[2rem] lg:grid-cols-2"
            style={{
              boxShadow:
                "0 40px 80px -20px rgba(6, 24, 40, 0.42), 0 16px 32px -12px rgba(6, 24, 40, 0.2)",
            }}
          >
            <div
              className="relative flex flex-col justify-center px-8 py-14 sm:px-12 sm:py-16"
              style={{ background: "linear-gradient(160deg, #073157 0%, #0c5290 80%)" }}
            >
              <Eyebrow light>{copy.finalCta.eyebrow}</Eyebrow>
              <h2
                className="mt-5 max-w-md font-light text-white"
                style={{ fontSize: "clamp(1.75rem, 2.8vw, 2.5rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
              >
                {copy.finalCta.headlineLead}{" "}
                <strong className="font-bold">{copy.finalCta.headlineBold}</strong>
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/75">
                {copy.finalCta.body}
              </p>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={scrollToPlans}
                  className="group inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110"
                  style={{ background: GO_GRADIENT, boxShadow: GO_SHADOW }}
                >
                  {copy.finalCta.button}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
            <div className="relative hidden min-h-[380px] overflow-hidden lg:block">
              <MembershipConferenceVideo />
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-slate-200/80 bg-white/90">
        <div className="mx-auto max-w-[1200px] px-6 py-5 sm:px-8 sm:py-6">
          <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
            <Link href="/coach/community" className="justify-self-center sm:justify-self-start">
              <Image
                src="/profit-coach-logo.svg"
                alt="The Profit Coach"
                width={238}
                height={68}
                className="h-12 w-auto sm:h-[3.25rem]"
              />
            </Link>
            <button
              type="button"
              onClick={scrollToPlans}
              className="group inline-flex w-full shrink-0 items-center justify-center gap-2.5 rounded-full px-9 py-4 text-base font-semibold text-white transition hover:brightness-110 sm:w-auto"
              style={{ background: GO_GRADIENT, boxShadow: GO_SHADOW }}
            >
              Choose your level
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <HelpContact
              stacked
              align="right"
              label={copy.footerCta.help}
              className="justify-self-center sm:justify-self-end"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
