"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Search } from "lucide-react";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  loadCoachDirectory,
  peekCoachDirectory,
  rememberCoachAccountLabel,
} from "@/lib/admin/coachDirectoryClient";
import { resolveCoachIdBySlug } from "@/lib/demoCoach";
import {
  pathAfterDemoCoachToggle,
  staffDemosAccessibleToEmail,
  type DemoCoachToggleUser,
} from "@/lib/demoCoachToggle";
import { supabaseClient } from "@/lib/supabaseClient";

const RECENT_KEY = "pc-use-as-recent-coach-ids";
const MAX_RECENT = 5;

type CoachListRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

type Props = {
  onAction?: () => void;
  /** Flyout sits beside the account menu. Inline expands in the mobile sheet. */
  layout?: "flyout" | "inline";
  /** Already-known admin role so the row shows as soon as the account menu opens. */
  isAdmin?: boolean;
};

function readRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function rememberRecentId(id: string): string[] {
  const next = [id, ...readRecentIds().filter((existing) => existing !== id)].slice(
    0,
    MAX_RECENT
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

function coachDisplayName(coach: CoachListRow): string {
  return (
    coach.full_name?.trim() ||
    coach.coach_business_name?.trim() ||
    coach.slug ||
    "Coach"
  );
}

function coachSearchText(coach: CoachListRow): string {
  return [coach.full_name, coach.coach_business_name, coach.slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function panelStyle(anchor: DOMRect): React.CSSProperties {
  const width = 288;
  const gap = 8;
  const margin = 8;
  const bottom = Math.max(margin, window.innerHeight - anchor.bottom);
  const maxHeight = `min(26rem, calc(100vh - ${margin * 2}px))`;
  const shared = {
    position: "fixed" as const,
    bottom,
    width: width + gap,
    maxHeight,
    zIndex: 120,
  };
  const opensRight = anchor.right + gap + width <= window.innerWidth - margin;
  if (opensRight) {
    return { ...shared, left: anchor.right, paddingLeft: gap };
  }
  return {
    ...shared,
    left: Math.max(margin, anchor.left - gap - width),
    paddingRight: gap,
  };
}

export function UseAsMenu({
  onAction,
  layout = "flyout",
  isAdmin: isAdminProp = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useDashboardProfile();
  const { impersonatingCoachId, setImpersonatingCoachId, clearImpersonation } =
    useImpersonation();
  const [emailReady, setEmailReady] = useState(false);
  const [demos, setDemos] = useState<DemoCoachToggleUser[]>([]);
  const [idsBySlug, setIdsBySlug] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coaches, setCoaches] = useState<CoachListRow[]>(
    () => peekCoachDirectory() ?? []
  );
  const [coachesLoaded, setCoachesLoaded] = useState(
    () => peekCoachDirectory() != null
  );
  const [loading, setLoading] = useState(() => peekCoachDirectory() == null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState<React.CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<number | null>(null);

  const isAdmin = isAdminProp || profile?.role === "admin";
  const show = isAdmin || (emailReady && demos.length > 0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      const accessible = staffDemosAccessibleToEmail(user?.email);
      setDemos(accessible);
      setEmailReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const cached = peekCoachDirectory();
    if (cached) {
      setCoaches(cached);
      setCoachesLoaded(true);
      setLoading(false);
    } else {
      setLoading(true);
    }
    void loadCoachDirectory()
      .then((rows) => {
        if (cancelled) return;
        setCoaches(rows);
        setCoachesLoaded(true);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || peekCoachDirectory()) return;
        setLoadError(
          err instanceof Error ? err.message : "Could not load coaches."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (demos.length === 0 || coaches.length === 0) return;
    setIdsBySlug((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const demo of demos) {
        const match = coaches.find(
          (coach) => coach.slug.toLowerCase() === demo.coachSlug
        );
        if (match && next[demo.coachSlug] !== match.id) {
          next[demo.coachSlug] = match.id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [coaches, demos]);

  useEffect(() => {
    if (!open) return;
    setRecentIds(readRecentIds());
  }, [open]);

  const place = useCallback(() => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return;
    setBox(panelStyle(anchor));
  }, []);

  useLayoutEffect(() => {
    if (!open || layout !== "flyout") return;
    place();
  }, [open, layout, place]);

  useEffect(() => {
    if (!open || layout !== "flyout") return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, layout, place]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current == null) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const openFlyout = useCallback(() => {
    if (layout !== "flyout") return;
    cancelClose();
    setOpen(true);
  }, [cancelClose, layout]);

  const scheduleClose = useCallback(() => {
    if (layout !== "flyout") return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setQuery("");
    }, 220);
  }, [cancelClose, layout]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!open || layout !== "inline") return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [layout, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const demoSlugs = useMemo(() => new Set(demos.map((demo) => demo.coachSlug)), [demos]);
  const demoIds = useMemo(
    () =>
      new Set(
        demos
          .map((demo) => idsBySlug[demo.coachSlug])
          .filter((id): id is string => Boolean(id))
      ),
    [demos, idsBySlug]
  );

  const coachRows = useMemo(
    () =>
      coaches.filter(
        (coach) => !demoSlugs.has(coach.slug) && !demoIds.has(coach.id)
      ),
    [coaches, demoIds, demoSlugs]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coachRows;
    return coachRows.filter((coach) => coachSearchText(coach).includes(q));
  }, [coachRows, query]);

  const searching = query.trim().length > 0;
  const recentRows = useMemo(() => {
    if (searching) return [];
    return recentIds
      .map((id) => coachRows.find((coach) => coach.id === id))
      .filter((coach): coach is CoachListRow => Boolean(coach))
      .slice(0, MAX_RECENT);
  }, [coachRows, recentIds, searching]);
  const directoryRows = searching ? filteredRows : coachRows;

  useEffect(() => {
    if (!open || !coachesLoaded || !impersonatingCoachId) return;
    if (demoIds.has(impersonatingCoachId)) return;
    if (!coachRows.some((coach) => coach.id === impersonatingCoachId)) return;
    setRecentIds((current) => {
      if (current[0] === impersonatingCoachId) return current;
      return rememberRecentId(impersonatingCoachId);
    });
  }, [coachRows, coachesLoaded, demoIds, impersonatingCoachId, open]);

  function finish() {
    setOpen(false);
    setQuery("");
    onAction?.();
  }

  async function selectAdmin() {
    if (busyId) return;
    if (!impersonatingCoachId) {
      finish();
      return;
    }
    setBusyId("admin");
    setError(null);
    clearImpersonation();
    router.push(pathAfterDemoCoachToggle(pathname ?? "/coach", "admin"));
    finish();
  }

  async function selectDemo(demo: DemoCoachToggleUser) {
    if (busyId) return;
    const existing = idsBySlug[demo.coachSlug] ?? null;
    if (existing && existing === impersonatingCoachId) {
      finish();
      return;
    }
    setBusyId(demo.coachSlug);
    setError(null);
    try {
      let coachId = existing;
      if (!coachId) {
        coachId = await resolveCoachIdBySlug(demo.coachSlug);
        setIdsBySlug((prev) => ({ ...prev, [demo.coachSlug]: coachId }));
      }
      if (!coachId) {
        setError(`${demo.label} not found.`);
        setBusyId(null);
        return;
      }
      rememberCoachAccountLabel(coachId, demo.label);
      setImpersonatingCoachId(coachId);
      router.push(pathAfterDemoCoachToggle(pathname ?? "/admin", "coach"));
      finish();
    } catch {
      setBusyId(null);
      setError(`Could not switch to ${demo.label}.`);
    }
  }

  function selectCoach(coach: CoachListRow) {
    if (busyId) return;
    if (coach.id === impersonatingCoachId) {
      finish();
      return;
    }
    setRecentIds(rememberRecentId(coach.id));
    rememberCoachAccountLabel(coach.id, coachDisplayName(coach));
    setImpersonatingCoachId(coach.id);
    const path = pathname ?? "/admin";
    if (!path.startsWith("/coach")) {
      router.push(pathAfterDemoCoachToggle(path, "coach"));
    }
    finish();
  }

  if (!show) return null;

  const panel = (
    <UseAsPanel
      inputRef={inputRef}
      query={query}
      onQuery={setQuery}
      demos={demos}
      idsBySlug={idsBySlug}
      impersonatingCoachId={impersonatingCoachId}
      busyId={busyId}
      error={error}
      isAdmin={Boolean(isAdmin)}
      loading={loading && !coachesLoaded}
      loadError={loadError}
      searching={searching}
      recentRows={recentRows}
      directoryRows={directoryRows}
      onAdmin={() => void selectAdmin()}
      onDemo={(demo) => void selectDemo(demo)}
      onCoach={selectCoach}
    />
  );

  return (
    <div className={layout === "inline" ? "mb-3" : "border-t border-slate-100"}>
      <button
        ref={buttonRef}
        type="button"
        role="menuitem"
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseEnter={openFlyout}
        onMouseLeave={scheduleClose}
        onClick={() => {
          if (layout === "flyout") {
            cancelClose();
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
            return;
          }
          setOpen((current) => !current);
        }}
        className={
          layout === "inline"
            ? "flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-900 shadow-sm"
            : "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
        }
      >
        <span className="min-w-0 flex-1">Use as</span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open && layout === "inline" ? "rotate-90" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && layout === "inline" ? <div className="mt-1">{panel}</div> : null}
      {open && layout === "flyout" && box && typeof document !== "undefined"
        ? createPortal(
            <div
              data-use-as-panel=""
              style={box}
              className="flex flex-col"
              onMouseEnter={openFlyout}
              onMouseLeave={scheduleClose}
            >
              {panel}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function UseAsPanel({
  inputRef,
  query,
  onQuery,
  demos,
  idsBySlug,
  impersonatingCoachId,
  busyId,
  error,
  isAdmin,
  loading,
  loadError,
  searching,
  recentRows,
  directoryRows,
  onAdmin,
  onDemo,
  onCoach,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQuery: (value: string) => void;
  demos: DemoCoachToggleUser[];
  idsBySlug: Record<string, string | null>;
  impersonatingCoachId: string | null;
  busyId: string | null;
  error: string | null;
  isAdmin: boolean;
  loading: boolean;
  loadError: string | null;
  searching: boolean;
  recentRows: CoachListRow[];
  directoryRows: CoachListRow[];
  onAdmin: () => void;
  onDemo: (demo: DemoCoachToggleUser) => void;
  onCoach: (coach: CoachListRow) => void;
}) {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  return (
    <div
      role="menu"
      aria-label="Use as"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)]"
    >
      <div className="border-b border-slate-100 p-2">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search coaches"
            aria-label="Search coaches"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </label>
      </div>
      <div className="max-h-80 min-h-0 overflow-y-auto py-1">
        <IdentityRow
          label="Admin"
          active={!impersonatingCoachId}
          busy={busyId === "admin"}
          disabled={Boolean(busyId)}
          onClick={onAdmin}
        />
        {demos.map((demo) => {
          const id = idsBySlug[demo.coachSlug];
          return (
            <IdentityRow
              key={demo.coachSlug}
              label={demo.label}
              active={Boolean(id) && id === impersonatingCoachId}
              busy={busyId === demo.coachSlug}
              disabled={Boolean(busyId)}
              onClick={() => onDemo(demo)}
            />
          );
        })}
        {isAdmin ? (
          <>
            <div className="mx-3 my-1 border-t border-slate-100" />
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading coaches…
              </div>
            ) : loadError ? (
              <p className="px-3 py-3 text-xs text-rose-600">{loadError}</p>
            ) : (
              <>
                {recentRows.length > 0 ? (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Recent
                    </p>
                    {recentRows.map((coach) => (
                      <CoachRow
                        key={`recent-${coach.id}`}
                        coach={coach}
                        active={coach.id === impersonatingCoachId}
                        busy={busyId === coach.id}
                        disabled={Boolean(busyId)}
                        onClick={() => onCoach(coach)}
                      />
                    ))}
                  </>
                ) : null}
                {searching ? (
                  directoryRows.length > 0 ? (
                    <>
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Matches
                      </p>
                      {directoryRows.map((coach) => (
                        <CoachRow
                          key={coach.id}
                          coach={coach}
                          active={coach.id === impersonatingCoachId}
                          busy={busyId === coach.id}
                          disabled={Boolean(busyId)}
                          onClick={() => onCoach(coach)}
                        />
                      ))}
                    </>
                  ) : (
                    <p className="px-3 py-3 text-xs text-slate-500">No coaches match.</p>
                  )
                ) : directoryRows.length > 0 ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={directoryOpen}
                      onClick={() => setDirectoryOpen((current) => !current)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1 font-medium">All coaches</span>
                      <span className="text-xs text-slate-400">{directoryRows.length}</span>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                          directoryOpen ? "rotate-90" : ""
                        }`}
                        aria-hidden
                      />
                    </button>
                    {directoryOpen
                      ? directoryRows.map((coach) => (
                          <CoachRow
                            key={coach.id}
                            coach={coach}
                            active={coach.id === impersonatingCoachId}
                            busy={busyId === coach.id}
                            disabled={Boolean(busyId)}
                            onClick={() => onCoach(coach)}
                          />
                        ))
                      : null}
                  </>
                ) : null}
              </>
            )}
          </>
        ) : null}
        {error ? <p className="px-3 py-2 text-xs text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}

function IdentityRow({
  label,
  active,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-60 ${
        active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
      ) : busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" aria-hidden />
      ) : null}
    </button>
  );
}

function CoachRow({
  coach,
  active,
  busy,
  disabled,
  onClick,
}: {
  coach: CoachListRow;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const name = coachDisplayName(coach);
  const business = coach.coach_business_name?.trim() || "";
  const showBusiness = Boolean(business) && business !== name;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left disabled:opacity-60 ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${active ? "font-medium" : ""}`}>
          {name}
        </span>
        {showBusiness ? (
          <span className="block truncate text-[11px] text-slate-500">{business}</span>
        ) : null}
      </span>
      {active ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
      ) : busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" aria-hidden />
      ) : null}
    </button>
  );
}
