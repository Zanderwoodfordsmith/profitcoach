"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown, ChevronRight, FileCheck2, MessageSquare, Plus, Send, Zap } from "lucide-react";

import type { BoardCoach } from "@/app/api/admin/blueprints/route";
import type { LaunchStepKey } from "@/lib/practiceKnowledge/boardData";
import { PageIcon } from "@/components/practice/pageIcons";
import { STAGE_LOOK, StageCircle } from "@/components/practice/StageCircle";
import { BLUEPRINT_GROUPS } from "@/lib/practiceKnowledge/blueprint";
import { BOARD_COLUMNS, BOARD_TAGS, progressOf, type BoardColumnId, type BoardTag } from "@/lib/practiceKnowledge/blueprintBoard";
import { supabaseClient } from "@/lib/supabaseClient";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";

type Page = { slug: string; title: string };
type View = "board" | "coaches";

const VIEW_KEY = "admin-blueprints-view";
const GROUP_KEY = "admin-blueprints-grouped";
const SORT_KEY = "admin-blueprints-sort";

type Sort = "newest" | "oldest" | "needs" | "least" | "name";
const SORTS: { id: Sort; label: string }[] = [
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

function sortCoaches(list: BoardCoach[], sort: Sort): BoardCoach[] {
  const joined = (c: BoardCoach) => c.joined_at ?? "";
  return [...list].sort((a, b) => {
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


/** Open the coach's page in their Blueprint, with Activity (BCA's work) or the chat (theirs) open. */
function cardHref(coach: BoardCoach, page: string, column: BoardColumnId): string | null {
  if (!coach.slug) return null;
  const panel = column === "needs_coach" || column === "coach_review" || column === "done" ? "chat" : "activity";
  return `/admin/coaches/${encodeURIComponent(coach.slug)}?tab=blueprint&doc=${encodeURIComponent(page)}&panel=${panel}&from=launches`;
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

export function BlueprintsBoard() {
  const [data, setData] = useState<{ coaches: BoardCoach[]; pages: Page[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>("board");
  const [everyone, setEveryone] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [grouped, setGroupedState] = useState(true);
  const [sort, setSortState] = useState<Sort>("newest");
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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after hydration
      if (saved === "coaches") setViewState(saved);
      if (window.localStorage.getItem(GROUP_KEY) === "no") setGroupedState(false);
      const savedSort = window.localStorage.getItem(SORT_KEY);
      if (SORTS.some((o) => o.id === savedSort)) setSortState(savedSort as Sort);
    } catch {
      // Storage blocked: the board.
    }
  }, []);
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
      window.localStorage.setItem(SORT_KEY, next);
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
    setData({ coaches: body.coaches, pages: body.pages });
  }, []);

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

  const launchingCount = data?.coaches.filter((c) => c.launching).length ?? 0;
  const coaches = useMemo(() => {
    if (!data) return [];
    return sortCoaches(
      data.coaches.filter((c) => everyone || c.launching),
      sort
    );
  }, [data, everyone, sort]);
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

  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-5 pt-6 md:px-6">
      <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-inset ring-slate-200" role="group" aria-label="Columns">
        {switchButton("board", "By status")}
        {switchButton("coaches", "By page")}
      </div>
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
            <div className="relative">
              <TableToolbarButton
                label="Add a coach"
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
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      {toolbar}
      {error ? <p className="px-6 py-4 text-sm text-rose-700">{error}</p> : null}
      {!data && !error ? <p className="px-6 py-4 text-sm text-slate-500">Loading the Blueprints…</p> : null}
      {data && view === "board" && !grouped ? (
        <Board coaches={coaches} pages={pages} showDone={showDone} onShowDone={() => setShowDone(true)} />
      ) : null}
      {data && view === "board" && grouped ? (
        <Lanes coaches={coaches} pages={pages} showDone={showDone} onShowDone={() => setShowDone(true)} />
      ) : null}
      {data && view === "coaches" ? (
        <PageLanes coaches={coaches} pages={pages} onTick={(coach_id, step, on) => void saveLaunch({ coach_id, tick: { step, on } })} />
      ) : null}
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

type Card = { coach: BoardCoach; page: Page; column: BoardColumnId; tag: BoardTag | null; note: string; unread: number };

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
  const href = cardHref(card.coach, card.page.slug, card.column);
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
function ConnectedMark({ connected }: { connected: boolean }) {
  const label = connected ? "LinkedIn connected" : "LinkedIn not connected";
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

/** Green tick when done, an empty ring when not. */
function StepMark({ done }: { done: boolean }) {
  if (!done) return <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-slate-300" aria-hidden />;
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

function PageLanes({
  coaches,
  pages,
  onTick,
}: {
  coaches: BoardCoach[];
  pages: Page[];
  onTick: (coachId: string, step: LaunchStepKey, on: boolean) => void;
}) {
  const lanes = laneRows(coaches, pages);
  // LinkedIn connected leads the coach's grey band, then a column per page, then the launch steps.
  const style = { gridTemplateColumns: `4.5rem 13rem 6rem repeat(${pages.length + 1 + LAUNCH_COLUMNS.length}, minmax(0, 1fr))` };
  // The coach's pages read as one grey band, top to bottom.
  const band = (slug: string) => (COACH_PAGES.has(slug) ? "bg-slate-100" : "");
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-10 md:px-6">
      <div className="min-w-[68rem] rounded-xl bg-white ring-1 ring-inset ring-slate-200">
        <div className="sticky top-0 z-10 grid rounded-t-xl border-b border-slate-200 bg-white px-2" style={style}>
          <h2 className="flex h-10 items-center px-1.5 text-sm font-semibold text-slate-900">Joined</h2>
          <span />
          <h2 className="flex h-10 items-center px-1.5 text-sm font-semibold text-slate-900">Progress</h2>
          <h2 className="flex h-10 items-center justify-center px-2 text-xs font-semibold text-slate-900 bg-slate-100" title="Have they connected their LinkedIn?">
            <span className="truncate">LI connected</span>
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
        </div>
        {lanes.length === 0 ? <p className="px-3.5 py-3 text-sm text-slate-500">No coaches here.</p> : null}
        <div className="divide-y divide-slate-200">
          {lanes.map((lane) => (
            <section key={lane.coach.coach_id} aria-label={lane.coach.name} className="grid items-stretch px-2 hover:bg-slate-50" style={style}>
              <span className="flex items-center">
                <JoinedCell iso={lane.coach.joined_at} />
              </span>
              <span className="flex min-w-0 items-center gap-2 px-1 py-2">
                <Face coach={lane.coach} />
                <span className="truncate text-sm font-semibold text-slate-900" title={lane.coach.name}>
                  {lane.coach.name}
                </span>
              </span>
              <span className="flex items-center">
                <ProgressCell coach={lane.coach} />
              </span>
              <span className="flex min-h-11 items-center justify-center bg-slate-100 px-2">
                <ConnectedMark connected={lane.coach.linkedin_connected} />
              </span>
              {pages.map((p) => {
                const card = lane.cards.find((c) => c.page.slug === p.slug);
                const cell = `flex min-h-11 items-center justify-center gap-1.5 px-2 ${band(p.slug)}`;
                if (!card) return <span key={p.slug} className={cell} />;
                const column = BOARD_COLUMNS.find((c) => c.id === card.column)!;
                const label = `${p.title}: ${column.label}${card.tag ? `, ${BOARD_TAGS[card.tag].label}` : ""}`;
                const href = cardHref(lane.coach, p.slug, card.column);
                const body = (
                  <>
                    <StageCircle look={STAGE_LOOK[card.column]} />
                    {card.tag ? <TagIcon tag={card.tag} /> : null}
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
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
