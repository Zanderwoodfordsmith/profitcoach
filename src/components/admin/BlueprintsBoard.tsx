"use client";

import { useLaunchColumns } from "@/components/admin/LaunchColumnsSwitch";
import type { CampaignKind } from "@/lib/practiceKnowledge/boardData";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, Check, ChevronDown, ChevronRight, FileCheck2, GripVertical, ListChecks, MessageSquare, Plus, Search, Send, Zap } from "lucide-react";

import type { BoardCoach } from "@/app/api/admin/blueprints/route";
import type { LaunchStepKey } from "@/lib/practiceKnowledge/boardData";
import { PageIcon } from "@/components/practice/pageIcons";
import { STAGE_LOOK, StageCircle } from "@/components/practice/StageCircle";
import { BLUEPRINT_GROUPS, blueprintPage } from "@/lib/practiceKnowledge/blueprint";
import { BOARD_COLUMNS, BOARD_TAGS, progressOf, type BoardColumnId, type BoardTag } from "@/lib/practiceKnowledge/blueprintBoard";
import type { ChainState, ToCheckItem } from "@/lib/launch/avaAuto";
import { formatSupportRelativeCompact } from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type Page = { slug: string; title: string };
type View = "check" | "board" | "coaches";

const VIEW_KEY = "admin-blueprints-view";
const GROUP_KEY = "admin-blueprints-grouped";
const SORT_KEY = "admin-blueprints-sort";
const EMBEDDED_SORT_KEY = "admin-coaches-launch-sort";

export type LaunchSort = "order" | "check" | "newest" | "oldest" | "needs" | "least" | "name";
type Sort = LaunchSort;
export const LAUNCH_SORTS: { id: Sort; label: string }[] = [
  { id: "order", label: "Your order" },
  { id: "check", label: "Most to check first" },
  { id: "newest", label: "Newest to join first" },
  { id: "oldest", label: "Longest ago first" },
  { id: "needs", label: "Most for BCA first" },
  { id: "least", label: "Least progress first" },
  { id: "name", label: "Name, A to Z" },
];
const SORTS: { id: Sort; label: string }[] = [
  { id: "check", label: "Most to check first" },
  { id: "newest", label: "Newest to join first" },
  { id: "oldest", label: "Longest ago first" },
  { id: "needs", label: "Most for BCA first" },
  { id: "least", label: "Least progress first" },
  { id: "name", label: "Name, A to Z" },
];

function percentOf(coach: BoardCoach): number {
  return progressOf(Object.values(coach.cards)).percent;
}

/** A slim bar and the percentage: points over the most the coach could have (5 a page). */
function ProgressCell({ coach }: { coach: BoardCoach }) {
  const { percent, points, max } = progressOf(Object.values(coach.cards));
  return (
    <span className="flex h-8 items-center gap-2 px-1.5" title={`${points} of ${max} points`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <span className="block h-full rounded-full bg-[#1a8fd4]" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-sm tabular-nums text-slate-700">{percent}%</span>
    </span>
  );
}

/** What BCA has to do for a coach: to check first, then Ava ready, then BCA to do. */
function bcaLoad(coach: BoardCoach): [number, number, number] {
  const cards = Object.values(coach.cards);
  return [
    cards.filter((c) => c.tag === "ava_done" || c.tag === "to_send").length,
    cards.filter((c) => c.tag === "ava_ready").length,
    cards.filter((c) => c.column === "bca_todo").length,
  ];
}

function sortCoaches(list: BoardCoach[], sort: Sort, checkCounts?: Map<string, number>): BoardCoach[] {
  const joined = (c: BoardCoach) => c.joined_at ?? "";
  return [...list].sort((a, b) => {
    if (sort === "order") {
      // Zander's working order (28 Nov); coaches without a number follow, most to check first.
      const o = (c: BoardCoach) => c.launch_order ?? 10_000;
      const n = (c: BoardCoach) => checkCounts?.get(c.coach_id) ?? 0;
      return o(a) - o(b) || n(b) - n(a) || a.name.localeCompare(b.name);
    }
    if (sort === "check") {
      const n = (c: BoardCoach) => checkCounts?.get(c.coach_id) ?? 0;
      // Ties: longest since joining first, as they're furthest into their 4 months (21 Nov).
      return n(b) - n(a) || (joined(a) || "9999").localeCompare(joined(b) || "9999") || a.name.localeCompare(b.name);
    }
    if (sort === "newest") return joined(b).localeCompare(joined(a)) || a.name.localeCompare(b.name);
    if (sort === "oldest") return (joined(a) || "9999").localeCompare(joined(b) || "9999") || a.name.localeCompare(b.name);
    if (sort === "least") return percentOf(a) - percentOf(b) || a.name.localeCompare(b.name);
    if (sort === "needs") {
      const [x, y] = [bcaLoad(a), bcaLoad(b)];
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}


/**
 * Open the coach's page in My Blueprint as they see it (Zander, 21 Nov), with
 * "Use as" switched to that coach. Ava's drafts and Release show there for BCA.
 */
function cardHref(coach: BoardCoach, page: string): string {
  const path = blueprintPage(page)?.href ?? `/coach/blueprint/${encodeURIComponent(page)}`;
  return `${path}?impersonate=${encodeURIComponent(coach.coach_id)}`;
}

function Face({ coach, size = 24 }: { coach: Pick<BoardCoach, "name" | "avatar_url">; size?: number }) {
  if (coach.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coach.avatar_url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600"
      style={{ width: size, height: size }}
    >
      {coach.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")}
    </span>
  );
}

/**
 * Admin → Coaches → Blueprint (3 Nov): BCA's own board. Every coach's
 * Blueprint pages as cards, by whose move it is; or a row per coach. A card
 * opens that coach's page with Ava's Activity open beside it.
 */
async function adminHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
}

type BoardData = { coaches: BoardCoach[]; pages: Page[] };
type CheckData = { items: ToCheckItem[]; chains: Record<string, ChainState[]> };

/**
 * The last board and To check this browser saw (23 Nov), so the Launch view
 * shows every coach and their last state at once, then refreshes underneath.
 * The board only mounts after the page loads, so reading storage here can't
 * clash with server rendering.
 */
const BOARD_STORE = "admin-launch-board-v1";
const CHECK_STORE = "admin-launch-to-check-v1";

function readStored<T>(key: string, valid: (v: T) => boolean): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null") as T | null;
    return value && valid(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full or blocked: the next visit just waits for the fresh load.
  }
}

let lastBoard: BoardData | null = null;
let lastCheck: CheckData | null = null;

function storedBoard(): BoardData | null {
  lastBoard ??= readStored<BoardData>(BOARD_STORE, (v) => Array.isArray(v.coaches) && Array.isArray(v.pages));
  return lastBoard;
}

function storedCheck(): CheckData | null {
  lastCheck ??= readStored<CheckData>(CHECK_STORE, (v) => Array.isArray(v.items) && typeof v.chains === "object" && v.chains !== null);
  return lastCheck;
}

/**
 * `embedded`: the Launch view inside Admin → Coaches → All coaches (21 Nov).
 * Only the By page grid, with a To check column. The page's own toolbar row
 * drives it: search, the Launching / Everyone filter and the sort; Add a coach
 * is portalled into `addSlot` in that row.
 */
export function BlueprintsBoard({
  embedded = false,
  search = "",
  everyone: everyoneProp,
  sort: sortProp,
  addSlot = null,
}: {
  embedded?: boolean;
  search?: string;
  everyone?: boolean;
  sort?: LaunchSort;
  addSlot?: HTMLElement | null;
} = {}) {
  const { setImpersonatingCoachId } = useImpersonation();
  const [data, setData] = useState<BoardData | null>(storedBoard);
  const [toCheck, setToCheck] = useState<ToCheckItem[] | null>(() => storedCheck()?.items ?? null);
  const [chains, setChains] = useState<Record<string, ChainState[]>>(() => storedCheck()?.chains ?? {});
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(embedded ? "coaches" : "board");
  const [everyone, setEveryone] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [grouped, setGroupedState] = useState(true);
  const [sort, setSortState] = useState<Sort>(embedded ? "check" : "newest");
  const [menu, setMenu] = useState<"sort" | "add" | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const sortKey = embedded ? EMBEDDED_SORT_KEY : SORT_KEY;
  useEffect(() => {
    try {
      if (embedded) {
        const savedSort = window.localStorage.getItem(EMBEDDED_SORT_KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after hydration
        if (SORTS.some((o) => o.id === savedSort)) setSortState(savedSort as Sort);
        return;
      }
      const saved = window.localStorage.getItem(VIEW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after hydration
      if (saved === "coaches" || saved === "check") setViewState(saved);
      if (window.localStorage.getItem(GROUP_KEY) === "no") setGroupedState(false);
      const savedSort = window.localStorage.getItem(SORT_KEY);
      if (SORTS.some((o) => o.id === savedSort)) setSortState(savedSort as Sort);
    } catch {
      // Storage blocked: the board.
    }
  }, [embedded]);
  const setView = (next: View) => {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; the switch still works.
    }
  };

  const setGrouped = (next: boolean) => {
    setGroupedState(next);
    try {
      window.localStorage.setItem(GROUP_KEY, next ? "yes" : "no");
    } catch {
      // Not remembered; the switch still works.
    }
  };

  const setSort = (next: Sort) => {
    setSortState(next);
    setMenu(null);
    try {
      window.localStorage.setItem(sortKey, next);
    } catch {
      // Not remembered; the sort still works.
    }
  };

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    const headers = await adminHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/blueprints", { headers }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { coaches?: BoardCoach[]; pages?: Page[]; error?: string } | null;
    if (isCancelled()) return;
    if (!res?.ok || !body?.coaches || !body.pages) {
      setError(body?.error ?? "Could not load the Blueprints.");
      return;
    }
    setError(null);
    lastBoard = { coaches: body.coaches, pages: body.pages };
    writeStored(BOARD_STORE, lastBoard);
    setData(lastBoard);
  }, []);

  /** What Ava has waiting for BCA, across coaches (16 Nov). */
  const loadToCheck = useCallback(async () => {
    const headers = await adminHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/launch/to-check", { headers }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { items?: ToCheckItem[]; chains?: Record<string, ChainState[]> } | null;
    if (!body?.items) return;
    lastCheck = { items: body.items, chains: body.chains ?? {} };
    writeStored(CHECK_STORE, lastCheck);
    setToCheck(lastCheck.items);
    setChains(lastCheck.chains);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch, not during the effect
    void loadToCheck();
  }, [loadToCheck, view]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch, not during the effect
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  /** Tick a launch step by hand, or put a coach on the launch list: the same save as Getting live. */
  const saveLaunch = useCallback(
    async (update: { coach_id: string; tick?: { step: LaunchStepKey; on: boolean }; add?: boolean }) => {
      const headers = await adminHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/getting-live", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(update),
      }).catch(() => null);
      if (!res?.ok) {
        const body = (await res?.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not save that.");
      }
      await load();
    },
    [load]
  );

  /** Save BCA's next step and order for a coach, and show it straight away. */
  const saveNote = useCallback(
    async (coach_id: string, update: { note?: string | null; order?: number | null }) => {
      const headers = await adminHeaders();
      if (!headers) return false;
      const res = await fetch("/api/admin/launch/note", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ coach_id, ...update }),
      }).catch(() => null);
      if (!res?.ok) {
        const body = (await res?.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not save that.");
        return false;
      }
      setData((cur) =>
        cur
          ? {
              ...cur,
              coaches: cur.coaches.map((c) =>
                c.coach_id === coach_id
                  ? {
                      ...c,
                      ...("note" in update ? { launch_note: update.note?.trim() || null } : {}),
                      ...("order" in update ? { launch_order: update.order ?? null } : {}),
                    }
                  : c
              ),
            }
          : cur
      );
      return true;
    },
    []
  );

  /** Drag and drop in Your order: number the coaches shown 1, 2, 3 in their new order and save them together. */
  const saveOrder = useCallback(async (orderedIds: string[]) => {
    const orderOf = new Map(orderedIds.map((id, i) => [id, i + 1]));
    setData((cur) =>
      cur ? { ...cur, coaches: cur.coaches.map((c) => (orderOf.has(c.coach_id) ? { ...c, launch_order: orderOf.get(c.coach_id)! } : c)) } : cur
    );
    const headers = await adminHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/launch/note", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ orders: orderedIds.map((coach_id, i) => ({ coach_id, order: i + 1 })) }),
    }).catch(() => null);
    if (!res?.ok) setError("Could not save the new order.");
  }, []);

  const launchingCount = data?.coaches.filter((c) => c.launching).length ?? 0;
  /** What's waiting for BCA per coach, and the page to open first (the To check column). */
  const checkByCoach = useMemo(() => {
    const map = new Map<string, { count: number; page: string }>();
    for (const item of toCheck ?? []) {
      const entry = map.get(item.coach_id);
      if (entry) entry.count += 1;
      else {
        const first = chains[item.coach_id]?.find((c) => c.state === "check")?.scope ?? item.job_key;
        map.set(item.coach_id, { count: 1, page: checkPage(first) });
      }
    }
    return map;
  }, [toCheck, chains]);
  /** Every page with something of Ava's waiting, per coach: lead-list plans count on Lead lists (21 Nov). */
  const checkPagesByCoach = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of toCheck ?? []) {
      const set = map.get(item.coach_id) ?? new Set<string>();
      const page = checkPage(item.job_key);
      // The Voice guide is filed under About You but is BCA's work: it shows on Ideal client (28 Nov).
      set.add(page === "about" ? "market" : page);
      map.set(item.coach_id, set);
    }
    return map;
  }, [toCheck]);
  const checkCounts = useMemo(
    () => new Map([...checkByCoach].map(([id, v]) => [id, v.count])),
    [checkByCoach]
  );
  const showEveryone = embedded ? Boolean(everyoneProp) : everyone;
  const activeSort = embedded ? (sortProp ?? "order") : sort;
  const query = search.trim().toLowerCase();
  const coaches = useMemo(() => {
    if (!data) return [];
    return sortCoaches(
      data.coaches.filter((c) => (showEveryone || c.launching) && (!query || c.name.toLowerCase().includes(query))),
      activeSort,
      checkCounts
    );
  }, [data, showEveryone, activeSort, checkCounts, query]);
  const pages = data?.pages ?? [];
  const notLaunching = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return (data?.coaches ?? [])
      .filter((c) => !c.launching && (!q || c.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, addQuery]);

  const switchButton = (id: View, label: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={view === id}
      onClick={() => setView(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        view === id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );

  const tab = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`;
  const popover = "absolute left-0 top-full z-[90] mt-1 rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]";

  const addControl = (
            <div className="relative">
              <TableToolbarButton
                label={embedded ? "Add to launch" : "Add a coach"}
                aria-haspopup="true"
                aria-expanded={menu === "add"}
                active={menu === "add"}
                onClick={() => setMenu((m) => (m === "add" ? null : "add"))}
                icon={<Plus className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {menu === "add" ? (
                <div className={`${popover} w-72 p-1.5`}>
                  <p className="px-2 pb-1 pt-1 text-xs font-semibold text-slate-700">Add to Launching</p>
                  <input
                    autoFocus
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                    placeholder="Search coaches"
                    className="mb-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                  />
                  <div className="max-h-72 overflow-y-auto">
                    {notLaunching.length === 0 ? <p className="px-2 py-1.5 text-sm text-slate-500">Nobody else to add.</p> : null}
                    {notLaunching.map((c) => (
                      <button
                        key={c.coach_id}
                        type="button"
                        onClick={() => {
                          setMenu(null);
                          setAddQuery("");
                          void saveLaunch({ coach_id: c.coach_id, add: true });
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Face coach={c} size={20} />
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
  );

  const toolbar = (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${embedded ? "px-4 py-3" : "px-4 pb-5 pt-6 md:px-6"}`}>
      {embedded ? null : (
        <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-inset ring-slate-200" role="group" aria-label="Columns">
          {switchButton("check", toCheck?.length ? `To check ${toCheck.length}` : "To check")}
          {switchButton("board", "By status")}
          {switchButton("coaches", "By page")}
        </div>
      )}
      {data ? (
        <>
          <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-inset ring-slate-200" role="group" aria-label="Which coaches">
            <button type="button" aria-pressed={!everyone} onClick={() => setEveryone(false)} className={tab(!everyone)}>
              Launching <span className={`tabular-nums ${!everyone ? "text-slate-300" : "text-slate-400"}`}>{launchingCount}</span>
            </button>
            <button type="button" aria-pressed={everyone} onClick={() => setEveryone(true)} className={tab(everyone)}>
              Everyone <span className={`tabular-nums ${everyone ? "text-slate-300" : "text-slate-400"}`}>{data.coaches.length}</span>
            </button>
          </div>
          {view === "board" ? (
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
              <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} className="h-4 w-4 accent-slate-900" />
              Group by coach
            </label>
          ) : null}
          <div ref={menuRef} className="flex items-center gap-1">
            <div className="relative">
              <TableToolbarButton
                label="Sort"
                aria-haspopup="true"
                aria-expanded={menu === "sort"}
                active={menu === "sort"}
                onClick={() => setMenu((m) => (m === "sort" ? null : "sort"))}
                icon={<ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {menu === "sort" ? (
                <div className={`${popover} w-60 p-1.5`}>
                  <p className="px-2 pb-1 pt-1 text-xs font-semibold text-slate-700">Sort coaches by</p>
                  {SORTS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSort(o.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="flex-1">{o.label}</span>
                      {sort === o.id ? <Check className="h-4 w-4 text-slate-500" aria-hidden /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {addControl}
          </div>
        </>
      ) : null}
    </div>
  );

  // Page links open My Blueprint as that coach. "?impersonate=" only counts on a full load
  // (or a new tab), so switch "Use as" here too when one is clicked in place.
  const openAsCoach = (event: React.MouseEvent) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href*='impersonate=']");
    const id = link ? new URL(link.href).searchParams.get("impersonate") : null;
    if (id) setImpersonatingCoachId(id);
  };

  return (
    <div className={embedded ? "flex flex-col" : "flex min-h-0 flex-1 flex-col bg-slate-50"} onClickCapture={openAsCoach}>
      {embedded ? (addSlot && data ? createPortal(<div ref={menuRef}>{addControl}</div>, addSlot) : null) : toolbar}
      {error ? <p className="px-6 py-4 text-sm text-rose-700">{error}</p> : null}
      {!data && !error ? <p className="px-6 py-4 text-sm text-slate-500">Loading the Blueprints…</p> : null}
      {data && view === "board" && !grouped ? (
        <Board coaches={coaches} pages={pages} showDone={showDone} onShowDone={() => setShowDone(true)} />
      ) : null}
      {data && view === "board" && grouped ? (
        <Lanes coaches={coaches} pages={pages} showDone={showDone} onShowDone={() => setShowDone(true)} />
      ) : null}
      {data && view === "check" ? <ToCheck items={toCheck} chains={chains} coaches={data.coaches} pages={pages} /> : null}
      {data && view === "coaches" ? (
        <PageLanes
          coaches={coaches}
          pages={pages}
          onTick={(coach_id, step, on) => void saveLaunch({ coach_id, tick: { step, on } })}
          onSaveNote={embedded ? saveNote : undefined}
          onReorder={embedded && activeSort === "order" && !query ? (ids) => void saveOrder(ids) : undefined}
          checkByCoach={embedded ? checkByCoach : undefined}
          checkPagesByCoach={embedded ? checkPagesByCoach : undefined}
          bare={embedded}
        />
      ) : null}
    </div>
  );
}

/** Where each waiting thing is checked: its Blueprint page. Prospect lists wait on Your Ideal Client. */
function checkPage(jobKey: string): string {
  // Lead lists have their own Blueprint page since 21 Nov (job 248).
  if (jobKey === "lead-list") return "lists";
  return jobKey.startsWith("page:") ? jobKey.slice(5) : "market";
}

function CheckIcon({ kind }: { kind: ToCheckItem["kind"] }) {
  const Icon = kind === "searches" ? Search : kind === "message" ? MessageSquare : kind === "answers" ? ListChecks : FileCheck2;
  return <Icon className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />;
}

const CHAIN_LOOK: Record<ChainState["state"], { dot: string; text: string }> = {
  released: { dot: "bg-emerald-500", text: "text-slate-500" },
  check: { dot: "bg-amber-500", text: "text-amber-700" },
  next: { dot: "bg-sky-500", text: "text-sky-700" },
  waiting: { dot: "bg-slate-300", text: "text-slate-500" },
};

/** The launch chain (18 Nov): each step in order, and where it is. A step to check opens the page with Ava's strip. */
function ChainList({ chain, coach }: { chain: ChainState[]; coach: BoardCoach | null }) {
  return (
    <ol className="divide-y divide-slate-100">
      {chain.map((step, i) => {
        const look = CHAIN_LOOK[step.state];
        const href = step.state === "check" && coach ? cardHref(coach, checkPage(step.scope)) : null;
        const body = (
          <>
            <span className="w-4 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
            <span className={`h-2 w-2 shrink-0 rounded-full ${look.dot}`} aria-hidden />
            <span className={`min-w-0 flex-1 truncate text-sm ${step.state === "released" ? "text-slate-500" : "font-semibold text-slate-900"}`}>{step.label}</span>
            <span className={`shrink-0 truncate text-sm ${look.text}`}>{step.note}</span>
            {href ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /> : <span className="w-4 shrink-0" />}
          </>
        );
        return (
          <li key={step.id}>
            {href ? (
              <Link href={href} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * To check (16 Nov): everything Ava drafted by herself that waits for BCA,
 * by coach, oldest first. Each row opens the coach's page with Ava's strip
 * open: read it, change it, then Release (or Import it, or Send). Since 18 Nov
 * each coach shows the launch chain first, then anything else waiting.
 */
function ToCheck({
  items,
  chains,
  coaches,
  pages,
}: {
  items: ToCheckItem[] | null;
  chains: Record<string, ChainState[]>;
  coaches: BoardCoach[];
  pages: Page[];
}) {
  if (!items) return <p className="px-6 py-4 text-sm text-slate-500">Loading what&rsquo;s waiting…</p>;
  if (!items.length) {
    return <p className="px-6 py-4 text-sm text-slate-500">Nothing waiting for you. Ava drafts each piece as soon as what she needs is in.</p>;
  }
  const byId = new Map(coaches.map((c) => [c.coach_id, c]));
  const groups: { coach: BoardCoach | null; coachId: string; items: ToCheckItem[] }[] = [];
  for (const item of items) {
    let group = groups.find((g) => g.coachId === item.coach_id);
    if (!group) {
      group = { coach: byId.get(item.coach_id) ?? null, coachId: item.coach_id, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-10 md:px-6">
      <ul className="max-w-3xl space-y-4">
        {groups.map((group) => (
          <li key={group.coachId} className="overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-slate-200">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
              {group.coach ? <Face coach={group.coach} size={24} /> : null}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{group.coach?.name ?? "Coach"}</span>
              <span className="text-sm tabular-nums text-slate-500">{group.items.length} to check</span>
              {group.coach && (group.items[0] || chains[group.coachId]?.length) ? (
                <Link
                  // Their Blueprint, on the first page waiting on BCA: Ava's drafts show in place there (job 248, 21 Nov).
                  href={cardHref(group.coach, checkPage(chains[group.coachId]?.find((c) => c.state === "check")?.scope ?? group.items[0]?.job_key ?? "page:market"))}
                  className="text-sm font-medium text-sky-700 hover:underline"
                >
                  Open Blueprint
                </Link>
              ) : null}
            </div>
            {chains[group.coachId]?.length ? <ChainList chain={chains[group.coachId]} coach={group.coach} /> : null}
            {chains[group.coachId]?.length && group.items.some((item) => !chains[group.coachId].some((c) => c.itemId === item.id)) ? (
              <p className="border-t border-slate-100 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Also waiting</p>
            ) : null}
            <ul className="divide-y divide-slate-100">
              {group.items.filter((item) => !chains[group.coachId]?.some((c) => c.itemId === item.id)).map((item) => {
                const slug = checkPage(item.job_key);
                const page = pages.find((p) => p.slug === slug);
                const href = group.coach ? cardHref(group.coach, slug) : null;
                const body = (
                  <>
                    <CheckIcon kind={item.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">
                        {item.job_key === "lead-list" ? "Prospect lists" : (page?.title ?? slug)}
                      </span>
                      <span className="block truncate text-sm text-slate-600">{item.what}</span>
                    </span>
                    <time dateTime={item.created_at} className="shrink-0 text-xs tabular-nums text-slate-400">
                      {formatSupportRelativeCompact(item.created_at)}
                    </time>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  </>
                );
                return (
                  <li key={item.id}>
                    {href ? (
                      <Link href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "1 Oct": the day and short month they joined. */
function joinedLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(ms) ? "" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(ms);
}

/** The About You pages: the coach fills these in. */
const COACH_PAGES = new Set(BLUEPRINT_GROUPS.filter((g) => g.yours).flatMap((g) => g.pages.map((p) => p.slug)));

type Card = { coach: BoardCoach; page: Page; column: BoardColumnId; tag: BoardTag | null; note: string; unread: number; check_on?: string };

/** Ava done and To send wait on BCA's check. */
const forCheck = (card: Pick<Card, "tag">) => card.tag === "ava_done" || card.tag === "to_send";

/** A tag inside In progress: an icon, with its name on hover. */
function TagIcon({ tag }: { tag: BoardTag }) {
  const Icon = tag === "ava_ready" ? Zap : tag === "ava_done" ? FileCheck2 : Send;
  const colour = tag === "ava_ready" ? "text-[#0c5290]" : "text-amber-600";
  return (
    <span className="shrink-0" title={`${BOARD_TAGS[tag].label}: ${BOARD_TAGS[tag].hint}`}>
      <Icon className={`h-3.5 w-3.5 ${colour}`} aria-label={BOARD_TAGS[tag].label} />
    </span>
  );
}

function Board({
  coaches,
  pages,
  showDone,
  onShowDone,
}: {
  coaches: BoardCoach[];
  pages: Page[];
  showDone: boolean;
  onShowDone: () => void;
}) {
  const cards: Card[] = coaches.flatMap((coach) =>
    pages.map((page) => ({ coach, page, ...coach.cards[page.slug] })).filter((card) => Boolean(card.column))
  );
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-10 md:px-6">
      <div className="grid min-w-[68rem] grid-cols-5 gap-3">
        {BOARD_COLUMNS.map((column) => {
          const mine = cards.filter((c) => c.column === column.id);
          const folded = column.id === "done" && !showDone;
          return (
            <section key={column.id} aria-label={column.label} className="min-w-0 rounded-xl bg-slate-100/80 p-2">
              <h2 className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-sm font-semibold text-slate-900" title={column.hint}>
                <StageCircle look={STAGE_LOOK[column.id]} />
                {column.label}
                <span className="font-normal tabular-nums text-slate-500">{mine.length}</span>
              </h2>
              {folded && mine.length ? (
                <button type="button" onClick={onShowDone} className="px-1.5 pb-1 text-sm font-medium text-[#0c5290] hover:underline">
                  Show them
                </button>
              ) : mine.length ? (
                <ul className="space-y-1.5">
                  {mine.map((card) => (
                    <li key={`${card.coach.coach_id}:${card.page.slug}`}>
                      <CardLink card={card} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1.5 pb-1 text-sm text-slate-500">Nothing here.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The Board grouped by coach (4 Nov): the same columns with a row per coach,
 * so you can work coach by coach. The coach who most needs BCA comes first.
 * Rows start folded to a count per column; open one to see its cards, which
 * are just the page: the column already says what's next.
 */
/** One row per coach, in the chosen sort. Both views share it. */
function laneRows(coaches: BoardCoach[], pages: Page[]) {
  return coaches
    .map((coach) => {
      const cards: Card[] = pages
        .map((page) => ({ coach, page, ...coach.cards[page.slug] }))
        .filter((card) => Boolean(card.column));
      const count = (id: BoardColumnId) => cards.filter((c) => c.column === id).length;
      return { coach, cards, check: cards.filter(forCheck).length, ava: cards.filter((c) => c.tag === "ava_ready").length, bca: count("bca_todo") };
    });
}

function JoinedCell({ iso }: { iso: string | null }) {
  return <span className="flex h-8 items-center whitespace-nowrap px-1.5 text-sm tabular-nums text-slate-600">{joinedLabel(iso)}</span>;
}

function Lanes({
  coaches,
  pages,
  showDone,
  onShowDone,
}: {
  coaches: BoardCoach[];
  pages: Page[];
  showDone: boolean;
  onShowDone: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const lanes = laneRows(coaches, pages);
  const row = "grid grid-cols-[4.5rem_13rem_6rem_repeat(5,minmax(0,1fr))] gap-2";

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-10 md:px-6">
      <div className="min-w-[68rem]">
        <div className={`${row} sticky top-0 z-10 bg-slate-50 pb-2`}>
          <h2 className="px-1.5 pt-1 text-sm font-semibold text-slate-900">Joined</h2>
          <span />
          <h2 className="px-1.5 pt-1 text-sm font-semibold text-slate-900">Progress</h2>
          {BOARD_COLUMNS.map((column) => (
            <h2 key={column.id} className="flex items-center gap-2 px-1.5 pt-1 text-sm font-semibold text-slate-900" title={column.hint}>
              <StageCircle look={STAGE_LOOK[column.id]} />
              {column.label}
              <span className="font-normal tabular-nums text-slate-500">
                {lanes.reduce((n, l) => n + l.cards.filter((c) => c.column === column.id).length, 0)}
              </span>
            </h2>
          ))}
        </div>
        {lanes.length === 0 ? <p className="px-1.5 text-sm text-slate-500">No coaches here.</p> : null}
        <div className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-inset ring-slate-200">
          {lanes.map((lane) => {
            const id = lane.coach.coach_id;
            const isOpen = Boolean(open[id]);
            const toggle = () => setOpen((o) => ({ ...o, [id]: !isOpen }));
            return (
              <section key={id} aria-label={lane.coach.name} className={`${row} items-start px-2 py-1.5 ${isOpen ? "bg-slate-50/70" : "hover:bg-slate-50"}`}>
                <JoinedCell iso={lane.coach.joined_at} />
                <button type="button" aria-expanded={isOpen} onClick={toggle} className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left">
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />}
                  <Face coach={lane.coach} />
                  <span className="truncate text-sm font-semibold text-slate-900" title={lane.coach.name}>
                    {lane.coach.name}
                  </span>
                </button>
                <ProgressCell coach={lane.coach} />
                {BOARD_COLUMNS.map((column) => {
                  const mine = lane.cards.filter((c) => c.column === column.id);
                  if (!isOpen) {
                    return (
                      <button
                        key={column.id}
                        type="button"
                        onClick={toggle}
                        aria-label={`${lane.coach.name}: ${mine.length} ${column.label}`}
                        className="flex h-8 items-center px-1.5 text-left text-sm tabular-nums text-slate-700"
                      >
                        {mine.length || <span className="text-slate-300">·</span>}
                        {column.id === "in_progress" && mine.some(forCheck) ? (
                          <span className="ml-1.5 whitespace-nowrap text-xs font-semibold text-amber-700">· {mine.filter(forCheck).length} to check</span>
                        ) : null}
                      </button>
                    );
                  }
                  if (column.id === "done" && !showDone && mine.length) {
                    return (
                      <div key={column.id} className="min-w-0 py-1">
                        <button type="button" onClick={onShowDone} className="px-1.5 text-sm font-medium text-[#0c5290] hover:underline">
                          {mine.length} done · Show them
                        </button>
                      </div>
                    );
                  }
                  return (
                    <ul key={column.id} className="min-w-0 space-y-1.5 py-1" aria-label={column.label}>
                      {mine.map((card) => (
                        <li key={card.page.slug}>
                          <CardLink card={card} compact />
                        </li>
                      ))}
                    </ul>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CardLink({ card, compact = false }: { card: Card; compact?: boolean }) {
  const href = cardHref(card.coach, card.check_on ?? card.page.slug);
  const unread = card.unread ? (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums text-rose-700" title={`${card.unread} new in the chat`}>
      <MessageSquare className="h-3 w-3" aria-hidden />
      {card.unread}
    </span>
  ) : null;
  const title = (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-slate-900">
      <PageIcon slug={card.page.slug} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{card.page.title}</span>
      {card.tag ? <TagIcon tag={card.tag} /> : null}
    </span>
  );
  const body = compact ? (
    <span className="flex items-center gap-2">
      {title}
      {unread}
    </span>
  ) : (
    <>
      <span className="flex items-center gap-2">
        <Face coach={card.coach} size={20} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-600">{card.coach.name}</span>
        {unread}
      </span>
      <span className="mt-1.5 flex">{title}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{card.note}</span>
    </>
  );
  // About You is the coach's part: grey, so BCA's pages stand out (4 Nov).
  const coachPart = COACH_PAGES.has(card.page.slug);
  const cls = `block rounded-lg px-2.5 py-2 ring-1 ring-inset transition hover:ring-slate-300 hover:shadow-sm ${
    coachPart ? "bg-slate-100 ring-slate-200/60" : "bg-white ring-slate-200/80"
  }`;
  return href ? (
    <Link href={href} className={cls} title={coachPart ? "The coach's part (About You)" : undefined}>
      {body}
    </Link>
  ) : (
    <div className={cls} title="This coach has no profile address yet">
      {body}
    </div>
  );
}

/**
 * By page (4 Nov): the same rows, with a column per Blueprint page and its
 * status circle in each cell. The coach's own pages (About You) are grey.
 */
/** A filled circle: green with a tick when LinkedIn is connected, red with a cross when not. */
function ConnectedMark({ connected, what = "LinkedIn connected" }: { connected: boolean; what?: string }) {
  const label = connected ? what : `No: ${what}`;
  return (
    <svg viewBox="0 0 14 14" className={`h-3.5 w-3.5 shrink-0 ${connected ? "text-emerald-500" : "text-rose-500"}`} role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      {connected ? (
        <path d="M4.2 7.2 6.1 9 9.8 5.2" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M4.8 4.8 9.2 9.2 M9.2 4.8 4.8 9.2" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Light grey circle with a white bar: can't tell yet, waiting on something else (21 Nov). Same size as the tick and cross. */
function WaitingMark({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0 text-slate-300" role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      <path d="M4.3 7h5.4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Ava's work waiting for BCA (21 Nov): a slim, solid lightning bolt in blue. */
function AvaBolt() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} className="shrink-0 text-sky-600" aria-hidden>
      <path fill="currentColor" d="M16.8 1 4.8 14.2h6.6L7.4 23 19.2 9.6h-6.6L16.8 1Z" />
    </svg>
  );
}

/** Column headings short enough for one line: "Your Ideal Client" is "Ideal Client", "LinkedIn Profile" is "LI Profile". */
function shortTitle(title: string): string {
  return title.replace(/^Your /, "").replace(/^LinkedIn Profile$/, "LI Profile");
}

/** The launch steps that aren't pages, after the pages (4 Nov). Ticked from the app where it can see them, else by hand. */
const LAUNCH_COLUMNS: { key: LaunchStepKey; label: string; hint: string }[] = [
  { key: "blueprint_call", label: "Call", hint: "Blueprint call held" },
  { key: "leads_found", label: "Prospects", hint: "A prospect list of 2,500 people" },
  { key: "campaign_live", label: "Live", hint: "The campaign is turned on" },
];

/** Green tick when done, an empty ring when not: the same ring as the status circles' BCA to do (16 Nov). */
function StepMark({ done }: { done: boolean }) {
  if (!done) {
    return (
      <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden>
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      <path d="M4.2 7.2 6.1 9 9.8 5.2" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LaunchCell({
  coach,
  column,
  onTick,
}: {
  coach: BoardCoach;
  column: (typeof LAUNCH_COLUMNS)[number];
  onTick: (coachId: string, step: LaunchStepKey, on: boolean) => void;
}) {
  const cell = "flex min-h-11 items-center justify-center gap-1.5 px-2 border-l border-slate-100";
  const step = coach.launch?.[column.key];
  if (!step) return <span className={cell} title="Not on the launch list" />;
  // The prospect count, until the list is full: "1,840 of 2,500" shows as 1,840.
  const count = column.key === "leads_found" && !step.done ? step.detail?.split(" of ")[0] : null;
  const body = count ? <span className="text-xs tabular-nums text-slate-600">{count}</span> : <StepMark done={step.done} />;
  const detail = step.detail ? `: ${step.detail}` : "";
  if (step.source === "app") {
    return (
      <span className={cell} title={`${column.hint}${detail} (from the app)`}>
        {body}
      </span>
    );
  }
  const label = `${column.hint}${detail}. ${step.done ? "Click to untick" : "Click to tick by hand"}`;
  return (
    <button type="button" title={label} aria-label={`${coach.name}: ${label}`} onClick={() => onTick(coach.coach_id, column.key, !step.done)} className={`${cell} hover:bg-slate-200/70`}>
      {body}
    </button>
  );
}

/**
 * The Launch view's Outputs columns (28 Nov): the agreed outputs in launch
 * order, instead of Blueprint pages. Pages keep their marks and links; the
 * rest come from the coach's campaigns, newsletters, posts and booking pages.
 */
type OutputColumn =
  | { key: string; label: string; hint: string; start?: boolean; kind: "page" | "lists"; page: string }
  | { key: string; label: string; hint: string; start?: boolean; kind: "linkedin" | "salesnav" | "newsletters" | "posts" | "booking" | "connections" | "notbuilt" }
  | { key: string; label: string; hint: string; start?: boolean; kind: "campaign"; campaign: CampaignKind; page?: string; appCant?: boolean };

const OUTPUT_COLUMNS: OutputColumn[] = [
  { key: "about", label: "About You", hint: "Coach: About You", kind: "page", page: "about", start: true },
  { key: "li", label: "LinkedIn", hint: "Coach: LinkedIn connected", kind: "linkedin" },
  { key: "sn", label: "Sales Nav", hint: "Coach: Sales Navigator on their LinkedIn", kind: "salesnav" },
  { key: "market", label: "Ideal client", hint: "Build: ideal client, market and voice", kind: "page", page: "market", start: true },
  { key: "profile", label: "Profile", hint: "Build: LinkedIn profile", kind: "page", page: "linkedin" },
  { key: "lists", label: "Lists", hint: "Build: prospect lists. Hover for each list", kind: "lists", page: "lists" },
  { key: "conns", label: "Connections", hint: "Build: their LinkedIn connections brought into Prospects, once at launch", kind: "connections" },
  { key: "connect", label: "Connect", hint: "Campaign: Connect, to people they aren't connected to", kind: "campaign", campaign: "connect", page: "campaigns", start: true },
  { key: "vip", label: "VIP", hint: "Campaign: VIP, personal messages to connected owners who fit", kind: "campaign", campaign: "vip", appCant: true },
  { key: "referral", label: "Referral", hint: "Campaign: Referral, to people they know", kind: "campaign", campaign: "referral", page: "campaigns" },
  { key: "interested", label: "Interested", hint: "Campaign: Interested, follow-up after a yes, a BOSS Score or a no-show", kind: "campaign", campaign: "interested", appCant: true },
  { key: "news", label: "Newsletters", hint: "Content: newsletters published, out of 6", kind: "newsletters", start: true },
  { key: "posts", label: "Posts", hint: "Content: LinkedIn posts in the last 30 days", kind: "posts" },
  { key: "booking", label: "Booking", hint: "Pages: a booking page switched on", kind: "booking", start: true },
];

function OutputCampaignCell({ coach, column, waitingHere, href }: { coach: BoardCoach; column: Extract<OutputColumn, { kind: "campaign" }>; waitingHere: boolean; href: string | null }) {
  const list = coach.outputs?.campaigns?.[column.campaign] ?? [];
  const running = list.filter((c) => c.status === "running");
  const names = list.map((c) => `${c.name} (${c.status})`).join(", ");
  const matched = "Matched by its playbook and name.";
  if (running.length) return <ConnectedMark connected what={`${column.label} running: ${names}. ${matched}`} />;
  if (waitingHere && href) {
    return (
      <Link href={href} title={`${column.label}: Ava's draft is waiting for you. Click to check it`} className="flex h-full w-full items-center justify-center hover:bg-slate-200/70">
        <AvaBolt />
      </Link>
    );
  }
  // VIP and Referral: how many they've tagged, against the starting aims (28 Nov).
  if (column.campaign === "vip" || column.campaign === "referral") {
    const kind = column.campaign;
    if (kind === "referral" && coach.outputs?.referral_off) {
      return (
        <span className="text-xs font-medium text-slate-500" title="They chose not to use their network for referrals for now">
          Off
        </span>
      );
    }
    const n = coach.outputs?.tagged?.[kind] ?? 0;
    const aim = kind === "vip" ? 50 : 10;
    const status = list.length ? ` ${column.label} campaign: ${names}.` : "";
    return (
      <span
        className={`text-xs font-semibold tabular-nums ${n >= aim ? "text-emerald-700" : n > 0 ? "text-slate-700" : "text-slate-400"}`}
        title={`${n} tagged ${column.label}. Aim for ${aim} to start, ${kind === "vip" ? 100 : 20}+ is great.${status}`}
      >
        {n}/{aim}
      </span>
    );
  }
  if (list.length) return <StepMark done={false} />;
  if (column.appCant) return <NotBuiltMark label={`${column.label}: the app can't set this up yet`} />;
  return <WaitingMark label={`No ${column.label} campaign yet`} />;
}

function NotBuiltMark({ label }: { label: string }) {
  return (
    <span className="text-sm text-slate-300" title={label} aria-label={label}>
      –
    </span>
  );
}

/** A hover card in a floating layer, so the scrolling grid can't clip it. */
function HoverCard({ children, card, className }: { children: React.ReactNode; card: React.ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const width = 320;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8)) });
  };
  return (
    <span
      className={className}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[80] w-80 rounded-lg border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 shadow-[0_12px_32px_-12px_rgba(5,30,54,0.35)]"
              style={{ top: pos.top, left: pos.left }}
            >
              {card}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}

/** Prospects for one coach: the total as the mark, each list on hover (28 Nov). */
function ListsCell({ coach, waiting, href, className }: { coach: BoardCoach; waiting: boolean; href: string | null; className: string }) {
  const facts = coach.outputs?.lists;
  const pool = facts?.pool ?? 0;
  const fmt = (n: number) => n.toLocaleString("en-GB");
  const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
  const plan = facts?.plan ?? null;
  const card = (
    <span className="flex flex-col gap-2">
      <span className="block">
        <span className="font-semibold text-slate-900">{fmt(pool)} people in Prospects</span>
        <span className="block text-xs text-slate-500">Target: 1,000 to 2,500, as several lists</span>
      </span>
      {plan ? (
        <span className="block">
          <span className="block text-xs font-semibold text-slate-900">
            Ava&apos;s plan · {plan.status === "open" ? "waiting for your check" : "released"}
          </span>
          {plan.planned.slice(0, 8).map((p) => (
            <span key={p.label} className="flex justify-between gap-3 text-xs">
              <span className="truncate">{p.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {p.imported != null ? `${fmt(p.imported)} in` : p.size != null ? `about ${fmt(p.size)}, not in yet` : "not in yet"}
              </span>
            </span>
          ))}
          {plan.planned.length > 8 ? <span className="block text-xs text-slate-500">and {plan.planned.length - 8} more</span> : null}
        </span>
      ) : null}
      {facts?.lists.length ? (
        <span className="block">
          <span className="block text-xs font-semibold text-slate-900">Their lists</span>
          {facts.lists.slice(0, 6).map((l) => (
            <span key={l.name} className="flex justify-between gap-3 text-xs">
              <span className="truncate">{l.name}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{fmt(l.count)}</span>
            </span>
          ))}
          {facts.lists.length > 6 ? <span className="block text-xs text-slate-500">and {facts.lists.length - 6} more</span> : null}
        </span>
      ) : null}
      <span className="block text-xs">
        <span className="block font-semibold text-slate-900">Connections</span>
        {facts?.connections != null ? `${fmt(facts.connections)} imported. ` : "Not imported yet. "}
        Owners who fit and People I know aren&apos;t built yet (job 320).
      </span>
    </span>
  );
  const mark = waiting ? (
    <AvaBolt />
  ) : pool >= 1000 ? (
    <span className="text-xs font-semibold tabular-nums text-emerald-700">{short(pool)}</span>
  ) : pool > 0 ? (
    <span className="text-xs font-semibold tabular-nums text-slate-700">{short(pool)}</span>
  ) : (
    <StepMark done={false} />
  );
  return (
    <HoverCard className={className} card={card}>
      {href ? (
        <Link href={href} aria-label={`Lists for ${coach.name}`} className="flex h-full w-full items-center justify-center hover:bg-slate-200/70">
          {mark}
        </Link>
      ) : (
        mark
      )}
    </HoverCard>
  );
}

/** The coach's place in Zander's order and BCA's next step. Click to change either (28 Nov). */
function NextStepCell({
  coach,
  onSave,
}: {
  coach: BoardCoach;
  onSave: (coachId: string, update: { note?: string | null; order?: number | null }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(coach.launch_note ?? "");
  const [order, setOrder] = useState(coach.launch_order == null ? "" : String(coach.launch_order));
  const [saving, setSaving] = useState(false);
  const open = () => {
    setNote(coach.launch_note ?? "");
    setOrder(coach.launch_order == null ? "" : String(coach.launch_order));
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    const n = order.trim() ? Number(order) : null;
    const ok = await onSave(coach.coach_id, { note: note.trim() || null, order: Number.isFinite(n) ? n : null });
    setSaving(false);
    if (ok) setEditing(false);
  };
  if (editing) {
    return (
      <span className="flex flex-col gap-1.5 px-1.5 py-2">
        <span className="flex items-center gap-2">
          <label className="text-xs text-slate-600" htmlFor={`order-${coach.coach_id}`}>
            Order
          </label>
          <input
            id={`order-${coach.coach_id}`}
            value={order}
            onChange={(e) => setOrder(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="h-7 w-12 rounded-md border border-slate-300 px-1.5 text-sm tabular-nums focus:border-[#0C5290] focus:outline-none"
          />
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
            if (e.key === "Escape") setEditing(false);
          }}
          rows={3}
          autoFocus
          aria-label={`Next step for ${coach.name}`}
          className="w-full resize-y rounded-md border border-slate-300 px-2 py-1 text-sm leading-snug focus:border-[#0C5290] focus:outline-none"
        />
        <span className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => void save()} disabled={saving} className="font-semibold text-[#0C5290] hover:underline disabled:opacity-60">
            {saving ? "Saving" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-slate-600 hover:underline">
            Cancel
          </button>
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      title={coach.launch_note ?? "Add the next step"}
      className="flex min-w-0 items-start gap-2 px-1.5 py-2 text-left hover:bg-slate-100"
    >
      <span className="mt-px w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">{coach.launch_order ?? ""}</span>
      <span className={`line-clamp-3 text-sm leading-snug ${coach.launch_note ? "text-slate-700" : "text-slate-400"}`}>
        {coach.launch_note ?? "Add the next step"}
      </span>
    </button>
  );
}

function PageLanes({
  coaches,
  pages,
  onTick,
  onSaveNote,
  onReorder,
  checkByCoach,
  checkPagesByCoach,
  bare = false,
}: {
  coaches: BoardCoach[];
  pages: Page[];
  onTick: (coachId: string, step: LaunchStepKey, on: boolean) => void;
  /** The Launch view on All coaches: BCA's next step and order per coach (28 Nov). */
  onSaveNote?: (coachId: string, update: { note?: string | null; order?: number | null }) => Promise<boolean>;
  /** Drag rows to reorder (Launch view, sorted by Your order, 28 Nov). */
  onReorder?: (orderedIds: string[]) => void;
  /** The Launch view on All coaches: a To check column after Progress (21 Nov). */
  checkByCoach?: Map<string, { count: number; page: string }>;
  /** Pages with something waiting in To check, so they show the lightning even if the page's stage doesn't know. */
  checkPagesByCoach?: Map<string, Set<string>>;
  /** Inside a card already: no frame of its own. */
  bare?: boolean;
}) {
  const lanes = laneRows(coaches, pages);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const drop = (targetId: string) => {
    if (!onReorder || !dragId || dragId === targetId) return;
    const ids = lanes.map((l) => l.coach.coach_id).filter((id) => id !== dragId);
    const at = ids.indexOf(targetId);
    const from = lanes.findIndex((l) => l.coach.coach_id === dragId);
    const to = lanes.findIndex((l) => l.coach.coach_id === targetId);
    // Dragging down drops after the target, dragging up drops before it.
    ids.splice(from < to ? at + 1 : at, 0, dragId);
    onReorder(ids);
  };
  const withCheck = Boolean(checkByCoach);
  const withNote = Boolean(onSaveNote);
  const launchColumns = useLaunchColumns();
  // Outputs columns only on the Launch view (where the note and To check columns are).
  const outputsMode = withNote && launchColumns === "outputs";
  // LinkedIn connected leads the coach's grey band, then a column per page, then the launch steps.
  const style = {
    gridTemplateColumns: `13rem ${withNote ? (outputsMode ? "16rem " : "19rem ") : ""}4.5rem 6rem ${withCheck ? "6.5rem " : ""}repeat(${
      outputsMode ? OUTPUT_COLUMNS.length : pages.length + 3 + LAUNCH_COLUMNS.length
    }, minmax(${outputsMode ? "4.75rem" : "0"}, 1fr))`,
  };
  // The coach's pages read as one grey band, top to bottom.
  const band = (slug: string) => (COACH_PAGES.has(slug) ? "bg-slate-100" : "");
  return (
    <div className={bare ? "overflow-x-auto" : "min-h-0 flex-1 overflow-auto px-4 pb-10 md:px-6"}>
      <div
        className={`${outputsMode ? "min-w-[112rem]" : "min-w-[68rem]"} ${bare ? "" : "rounded-xl bg-white ring-1 ring-inset ring-slate-200"}`}
      >
        <div className={`sticky top-0 z-10 grid border-b border-slate-200 bg-white px-2 ${bare ? "" : "rounded-t-xl"}`} style={style}>
          {/* Coach then Joined, the same as the All coaches table (21 Nov). */}
          <h2 className="flex h-10 items-center px-1.5 text-sm font-semibold text-slate-900">Coach</h2>
          {withNote ? (
            <h2 className="flex h-10 items-center px-1.5 text-sm font-semibold text-slate-900" title="Your working order and what happens next for this coach. Click to change.">
              Next step
            </h2>
          ) : null}
          <h2 className="flex h-10 items-center px-1.5 text-sm font-semibold text-slate-900">Joined</h2>
          <h2 className="flex h-10 items-center px-1.5 text-sm font-semibold text-slate-900">Progress</h2>
          {withCheck ? (
            <h2 className="flex h-10 items-center px-1.5 text-sm font-semibold text-slate-900" title="What Ava has waiting for BCA to check or release. Opens their Blueprint on the first one.">
              To check
            </h2>
          ) : null}
          {outputsMode ? (
            OUTPUT_COLUMNS.map((c) => (
              <h2
                key={c.key}
                className={`flex h-10 items-center justify-center px-1 text-center text-xs font-semibold leading-tight text-slate-900 ${c.start ? "border-l border-slate-200" : ""}`}
                title={c.hint}
              >
                {c.label}
              </h2>
            ))
          ) : (
            <>
          <h2 className="flex h-10 items-center justify-center px-2 text-xs font-semibold text-slate-900 bg-slate-100" title="Have they connected their LinkedIn?">
            <span className="truncate">LI connected</span>
          </h2>
          <h2 className="flex h-10 items-center justify-center px-2 text-xs font-semibold text-slate-900 bg-slate-100" title="Do they have Sales Navigator on their LinkedIn? We need it to build their lists.">
            <span className="truncate">Sales Nav</span>
          </h2>
          <h2
            className="flex h-10 items-center justify-center px-2 text-xs font-semibold text-slate-900 bg-slate-100"
            title="Their LinkedIn Social Selling Index, out of 100. It loads when they connect LinkedIn and updates when they open it in the app. Needs Sales Navigator."
          >
            <span className="truncate">SSI</span>
          </h2>
          {pages.map((p) => (
            <h2
              key={p.slug}
              className={`flex h-10 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-slate-900 ${band(p.slug)}`}
              title={COACH_PAGES.has(p.slug) ? `${p.title}: the coach's part` : p.title}
            >
              <span className="truncate">{shortTitle(p.title)}</span>
            </h2>
          ))}
          {LAUNCH_COLUMNS.map((c) => (
            <h2 key={c.key} className="flex h-10 items-center justify-center border-l border-slate-100 px-2 text-xs font-semibold text-slate-900" title={c.hint}>
              <span className="truncate">{c.label}</span>
            </h2>
          ))}
            </>
          )}
        </div>
        {lanes.length === 0 ? <p className="px-3.5 py-3 text-sm text-slate-500">No coaches here.</p> : null}
        <div className="divide-y divide-slate-200">
          {lanes.map((lane) => (
            <section
              key={lane.coach.coach_id}
              aria-label={lane.coach.name}
              draggable={Boolean(onReorder)}
              onDragStart={(e) => {
                if (!onReorder) return;
                // Selecting text in a note being edited is not a row drag.
                if ((e.target as HTMLElement).closest?.("textarea, input")) {
                  e.preventDefault();
                  return;
                }
                setDragId(lane.coach.coach_id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!onReorder || !dragId) return;
                e.preventDefault();
                if (overId !== lane.coach.coach_id) setOverId(lane.coach.coach_id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(lane.coach.coach_id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`grid items-stretch px-2 hover:bg-slate-50 ${dragId === lane.coach.coach_id ? "opacity-50" : ""} ${
                overId === lane.coach.coach_id && dragId && dragId !== lane.coach.coach_id ? "bg-sky-50 ring-2 ring-inset ring-sky-400" : ""
              }`}
              style={style}
            >
              <span className="flex min-w-0 items-center gap-2 px-1 py-2">
                {onReorder ? (
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300 hover:text-slate-500" aria-label="Drag to reorder" />
                ) : null}
                <Face coach={lane.coach} />
                {lane.coach.slug ? (
                  <Link
                    href={`/admin/coaches/${encodeURIComponent(lane.coach.slug)}`}
                    className="truncate text-sm font-semibold text-slate-900 hover:underline"
                    title={lane.coach.name}
                  >
                    {lane.coach.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-semibold text-slate-900" title={lane.coach.name}>
                    {lane.coach.name}
                  </span>
                )}
              </span>
              {onSaveNote ? <NextStepCell coach={lane.coach} onSave={onSaveNote} /> : null}
              <span className="flex items-center">
                <JoinedCell iso={lane.coach.joined_at} />
              </span>
              <span className="flex items-center">
                <ProgressCell coach={lane.coach} />
              </span>
              {withCheck ? (
                <span className="flex items-center px-1.5">
                  {(() => {
                    const waiting = checkByCoach?.get(lane.coach.coach_id);
                    if (!waiting) return <span className="text-sm text-slate-300">·</span>;
                    return (
                      <Link
                        href={cardHref(lane.coach, waiting.page)}
                        className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200"
                        title="Open their Blueprint on the first thing waiting"
                      >
                        {waiting.count} to check
                      </Link>
                    );
                  })()}
                </span>
              ) : null}
              {outputsMode ? (
                OUTPUT_COLUMNS.map((c) => {
                  const cell = `flex min-h-11 items-center justify-center gap-1.5 px-1.5 ${c.start ? "border-l border-slate-100" : ""}`;
                  const o = lane.coach.outputs;
                  if (c.kind === "lists") {
                    const card = lane.cards.find((x) => x.page.slug === c.page);
                    const waiting = Boolean(checkPagesByCoach?.get(lane.coach.coach_id)?.has(c.page)) || Boolean(card && forCheck(card));
                    return <ListsCell key={c.key} coach={lane.coach} waiting={waiting} href={cardHref(lane.coach, c.page)} className={cell} />;
                  }
                  if (c.kind === "page" || (c.kind === "campaign" && c.page)) {
                    const slug = c.kind === "page" ? c.page : c.page!;
                    const card = lane.cards.find((x) => x.page.slug === slug);
                    const waitingHere = Boolean(checkPagesByCoach?.get(lane.coach.coach_id)?.has(slug));
                    const href = cardHref(lane.coach, card?.check_on ?? slug);
                    if (c.kind === "campaign") {
                      return (
                        <span key={c.key} className={cell}>
                          <OutputCampaignCell coach={lane.coach} column={c} waitingHere={waitingHere || Boolean(card && forCheck(card))} href={href} />
                        </span>
                      );
                    }
                    if (!card) return <span key={c.key} className={cell} />;
                    const needsCheck = forCheck(card) || waitingHere;
                    const column = BOARD_COLUMNS.find((x) => x.id === card.column)!;
                    const label = needsCheck ? `${card.page.title}: waiting for your check. Click to check it` : `${card.page.title}: ${column.label}`;
                    return (
                      <Link key={c.key} href={href} title={label} aria-label={label} className={`${cell} hover:bg-slate-200/70`}>
                        {needsCheck ? <AvaBolt /> : <StageCircle look={STAGE_LOOK[card.column]} />}
                      </Link>
                    );
                  }
                  if (c.kind === "campaign") {
                    return (
                      <span key={c.key} className={cell}>
                        <OutputCampaignCell coach={lane.coach} column={c} waitingHere={false} href={null} />
                      </span>
                    );
                  }
                  if (c.kind === "linkedin") return <span key={c.key} className={cell}><ConnectedMark connected={lane.coach.linkedin_connected} /></span>;
                  if (c.kind === "salesnav") {
                    return (
                      <span key={c.key} className={cell}>
                        {lane.coach.sales_navigator == null ? (
                          <WaitingMark label="Can't tell until their LinkedIn is connected" />
                        ) : (
                          <ConnectedMark connected={lane.coach.sales_navigator} what="Sales Navigator" />
                        )}
                      </span>
                    );
                  }
                  if (c.kind === "newsletters") {
                    const n = o?.newsletters_published ?? 0;
                    return (
                      <span key={c.key} className={cell} title={`${n} newsletter${n === 1 ? "" : "s"} published in the last 120 days (6 is the launch target)`}>
                        {n ? <span className="text-xs font-semibold tabular-nums text-slate-700">{Math.min(n, 6)}/6</span> : <StepMark done={false} />}
                      </span>
                    );
                  }
                  if (c.kind === "posts") {
                    const n = o?.posts_30d ?? 0;
                    return (
                      <span key={c.key} className={cell} title={`${n} LinkedIn post${n === 1 ? "" : "s"} in the last 30 days (from their imported history)`}>
                        {n ? <span className="text-xs font-semibold tabular-nums text-slate-700">{n}</span> : <StepMark done={false} />}
                      </span>
                    );
                  }
                  if (c.kind === "connections") {
                    const at = o?.connections_imported_at;
                    return (
                      <span key={c.key} className={cell}>
                        {at ? (
                          <ConnectedMark connected what={`Connections imported ${new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`} />
                        ) : (
                          <span title="Not imported yet: happens the next time Ava's launch chain runs for them, once LinkedIn is connected">
                            <StepMark done={false} />
                          </span>
                        )}
                      </span>
                    );
                  }
                  if (c.kind === "booking") {
                    const n = o?.booking_pages ?? 0;
                    return (
                      <span key={c.key} className={cell}>
                        {n ? <ConnectedMark connected what={`${n} booking page${n === 1 ? "" : "s"} switched on`} /> : <StepMark done={false} />}
                      </span>
                    );
                  }
                  return (
                    <span key={c.key} className={cell}>
                      <NotBuiltMark label={c.hint} />
                    </span>
                  );
                })
              ) : (
                <>
              <span className="flex min-h-11 items-center justify-center bg-slate-100 px-2">
                <ConnectedMark connected={lane.coach.linkedin_connected} />
              </span>
              <span className="flex min-h-11 items-center justify-center bg-slate-100 px-2">
                {lane.coach.sales_navigator == null ? (
                  <WaitingMark label="Can't tell until their LinkedIn is connected" />
                ) : (
                  <ConnectedMark connected={lane.coach.sales_navigator} what="Sales Navigator" />
                )}
              </span>
              <span className="flex min-h-11 items-center justify-center bg-slate-100 px-2">
                {lane.coach.ssi == null ? (
                  <WaitingMark label="No SSI: their LinkedIn isn't connected, or they don't have Sales Navigator" />
                ) : (
                  <span
                    className="text-xs font-semibold tabular-nums text-slate-700"
                    title={`SSI ${lane.coach.ssi} out of 100${lane.coach.ssi_checked_at ? `, as of ${new Date(lane.coach.ssi_checked_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`}
                  >
                    {Math.round(lane.coach.ssi)}
                  </span>
                )}
              </span>
              {pages.map((p) => {
                const card = lane.cards.find((c) => c.page.slug === p.slug);
                const cell = `flex min-h-11 items-center justify-center gap-1.5 px-2 ${band(p.slug)}`;
                if (!card) return <span key={p.slug} className={cell} />;
                const waitingHere = Boolean(checkPagesByCoach?.get(lane.coach.coach_id)?.has(p.slug));
                const column = BOARD_COLUMNS.find((c) => c.id === card.column)!;
                const label = forCheck(card) || waitingHere
                  ? `${p.title}: ${card.tag ? BOARD_TAGS[card.tag].label : "To check"}. Click to check it`
                  : `${p.title}: ${column.label}`;
                const href = cardHref(lane.coach, card.check_on ?? p.slug);
                // One mark a cell (21 Nov): an orange lightning when Ava's work is waiting for BCA's check, else the stage circle.
                const needsCheck = forCheck(card) || waitingHere;
                const body = (
                  <>
                    {needsCheck ? (
                      <AvaBolt />
                    ) : (
                      <StageCircle look={STAGE_LOOK[card.column]} />
                    )}
                    {card.unread ? (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-rose-700">
                        <MessageSquare className="h-3 w-3" aria-hidden />
                        {card.unread}
                      </span>
                    ) : null}
                  </>
                );
                return href ? (
                  <Link key={p.slug} href={href} title={label} aria-label={label} className={`${cell} hover:bg-slate-200/70`}>
                    {body}
                  </Link>
                ) : (
                  <span key={p.slug} title={label} className={cell}>
                    {body}
                  </span>
                );
              })}
              {LAUNCH_COLUMNS.map((c) => (
                <LaunchCell key={c.key} coach={lane.coach} column={c} onTick={onTick} />
              ))}
                </>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
