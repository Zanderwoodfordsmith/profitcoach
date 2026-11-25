"use client";

/**
 * Check fit (job 285, 25 Nov): one person and their business at a time, 30 a
 * round. Swipe, arrow keys or buttons: right Good, left Bad, up VIP (tagged
 * and Good), Blacklist by button or B, Skip with Space. Undo with Z. The card
 * answers "is this my kind of business?" first (25 Nov redesign). After a Bad call the next
 * card asks why (optional, one tap). When a round ends Ava re-sorts the rest
 * of the list using these calls.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Ban, Factory, Globe, MapPin, SkipForward, Star, ThumbsDown, ThumbsUp, Undo2, Users, X } from "lucide-react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { useGlassPlacement } from "@/components/ui/Modal";
import type { LeadCard } from "@/lib/leads/leadCard";
import { fitOption, type FitLabel } from "@/lib/pool/fit";
import type { FitBefore, FitCall } from "@/lib/pool/fitCalls";
import { poolDisplayName, type PoolPerson } from "@/lib/pool/poolPeople";

/** People per round; "Sort 30 more" starts another. */
export const FIT_ROUND = 30;
/** Ava's Good and Bad mixed in as spot checks each round. */
const SPOT_CHECKS = 3;
const SWIPE_PX = 90;
const REASONS = ["Wrong industry", "Too small", "Too big", "Not the owner", "Already know them"];

/** A call, or Skip (no call, nothing saved). */
type Move = FitCall | "skip";
type Done = { row: PoolPerson; call: Move; before: Promise<FitBefore | null> };

/** Who's worth a look: Ava's unsure (OK) first, then nobody's checked, with a few of her Good and Bad as spot checks. */
export function fitQueue(rows: PoolPerson[], skip: Set<string>, n = FIT_ROUND): PoolPerson[] {
  const open = rows.filter((r) => r.fit_by !== "person" && !r.blacklisted && !skip.has(r.id));
  const main = [...open.filter((r) => r.fit === "ok"), ...open.filter((r) => !r.fit)];
  const spots = [...open.filter((r) => r.fit === "good").slice(0, SPOT_CHECKS), ...open.filter((r) => r.fit === "bad").slice(0, SPOT_CHECKS)];
  const queue = main.slice(0, Math.max(0, n - spots.length));
  // Spot checks spread through the round, not bunched at the end.
  spots.slice(0, n - queue.length).forEach((spot, i) => {
    queue.splice(Math.min(queue.length, (i + 1) * 4), 0, spot);
  });
  // A short round tops up with more of Ava's Good and Bad.
  if (queue.length < n) {
    const used = new Set(queue.map((r) => r.id));
    queue.push(...open.filter((r) => !used.has(r.id)).slice(0, n - queue.length));
  }
  return queue;
}

const CALL_WORD: Record<Move, string> = { good: "Good", bad: "Bad", vip: "VIP", blacklist: "Blacklist", skip: "Skip" };

/** Each call's colour: buttons, the round tally and the swipe stamp. */
const TALLY: Record<Move, string> = {
  skip: "border-slate-200 bg-white text-slate-700",
  good: "border-emerald-300 bg-emerald-100 text-emerald-800",
  bad: "border-rose-300 bg-rose-100 text-rose-800",
  vip: "border-amber-300 bg-amber-100 text-amber-800",
  blacklist: "border-slate-300 bg-slate-200 text-slate-800",
};
const STAMP: Record<Move, string> = {
  skip: "border-slate-400 text-slate-500",
  good: "border-emerald-500 text-emerald-600",
  bad: "border-rose-500 text-rose-600",
  vip: "border-amber-500 text-amber-600",
  blacklist: "border-slate-500 text-slate-600",
};
const CALL_BUTTON =
  "flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 sm:text-sm";

/** The buttons, worst to best: Skip in the middle, VIP furthest right as the strongest yes. */
const MOVES: { move: Move; icon: typeof Ban; key: string; title: string; hover: string }[] = [
  { move: "blacklist", icon: Ban, key: "B", title: "Blacklist: never message them (B)", hover: "hover:bg-slate-300" },
  { move: "bad", icon: ThumbsDown, key: "←", title: "Bad (←)", hover: "hover:bg-rose-200" },
  { move: "skip", icon: SkipForward, key: "Space", title: "Skip: not sure (Space)", hover: "hover:bg-slate-50" },
  { move: "good", icon: ThumbsUp, key: "→", title: "Good (→)", hover: "hover:bg-emerald-200" },
  { move: "vip", icon: Star, key: "↑", title: "VIP: tagged and Good (↑)", hover: "hover:bg-amber-200" },
];

/** Longer than this shows "More". */
const DESC_SHORT = 200;
/** About longer than this (about five lines) shows "More". */
const ABOUT_SHORT = 380;

function siteLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

function siteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}

/** "Rotherham, England, United Kingdom" → "Rotherham". */
function placeOf(location: string | null | undefined): string | null {
  return location?.split(",")[0]?.trim() || null;
}


export function FitCheck({
  rows,
  listId,
  headers,
  loadCard,
  onCalled,
  onClose,
}: {
  /** The people shown in the table now (filters apply). */
  rows: PoolPerson[];
  listId: string;
  headers: () => Promise<Record<string, string> | null | undefined>;
  loadCard: (person: { name: string; linkedinUrl: string | null; website?: string | null; company?: string | null }) => Promise<LeadCard | null>;
  /** Keeps the table in step: the row's new fit, tags and blacklist flag. */
  onCalled: (rowId: string, patch: Partial<PoolPerson>) => void;
  /** resorted: Ava was asked to re-sort the list. */
  onClose: (resorted: boolean) => void;
}) {
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [queue, setQueue] = useState<PoolPerson[]>(() => fitQueue(rows, new Set()));
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Done[]>([]);
  const [sorted, setSorted] = useState(0);
  const [cards, setCards] = useState<Record<string, LeadCard | null>>({});
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<Move | null>(null);
  /** "More" opened on this card: the business description or the person's About. */
  const [opened, setOpened] = useState<{ id: string; part: "business" | "person" } | null>(null);
  const [photoFailed, setPhotoFailed] = useState<string | null>(null);
  const [askWhy, setAskWhy] = useState<{ row: PoolPerson; picked: string | null } | null>(null);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resorting, setResorting] = useState(false);
  const resortedRef = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const requested = useRef(new Set<string>());
  const overlayRef = useRef<HTMLDivElement>(null);
  useGlassPlacement(overlayRef, true);

  const row = queue[index] ?? null;
  const finished = index >= queue.length;

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/coach/lead-lists/${encodeURIComponent(listId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...((await headers()) ?? {}) },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; before?: FitBefore };
      if (!res.ok) throw new Error(json.error || "Could not save that.");
      return json;
    },
    [listId, headers]
  );

  // This card and the next two, so the next one is ready when the coach calls this one.
  useEffect(() => {
    for (const r of queue.slice(index, index + 3)) {
      if (requested.current.has(r.id)) continue;
      requested.current.add(r.id);
      void loadCard({ name: poolDisplayName(r) || r.full_name, linkedinUrl: r.linkedin_url, website: r.website, company: r.company })
        .catch(() => null)
        .then((card) => setCards((prev) => ({ ...prev, [r.id]: card })));
    }
  }, [queue, index, loadCard]);

  const resort = useCallback(async () => {
    if (resortedRef.current) return;
    resortedRef.current = true;
    setResorting(true);
    await post({ action: "fit_rerate" }).catch(() => null);
    setResorting(false);
  }, [post]);

  const decide = useCallback(
    (call: Move) => {
      if (!row || leaving) return;
      setError(null);
      setLeaving(call);
      if (call === "skip") {
        setHistory((prev) => [...prev, { row, call, before: Promise.resolve(null) }]);
        setAskWhy(null);
        window.setTimeout(() => {
          setLeaving(null);
          setDrag(null);
          setIndex((i) => i + 1);
        }, 160);
        return;
      }
      const before = post({ action: "fit_call", item_id: row.id, call })
        .then((json) => json.before ?? null)
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Could not save that.");
          return null;
        });
      const fit: FitLabel = call === "good" || call === "vip" ? "good" : "bad";
      onCalled(row.id, {
        fit,
        fit_by: "person",
        fit_why: call === "vip" ? "VIP" : call === "blacklist" ? "Blacklisted" : null,
        ...(call === "vip" && !row.tags.some((t) => t.toLowerCase() === "vip") ? { tags: [...row.tags, "VIP"] } : {}),
        ...(call === "blacklist" ? { blacklisted: true } : {}),
      });
      setHistory((prev) => [...prev, { row, call, before }]);
      setSorted((n) => n + 1);
      setAskWhy(call === "bad" || call === "blacklist" ? { row, picked: null } : null);
      setOther("");
      // The round's last call: Ava re-sorts the rest with these calls (after it has saved).
      if (index + 1 >= queue.length) void before.then(() => resort());
      window.setTimeout(() => {
        setLeaving(null);
        setDrag(null);
        setIndex((i) => i + 1);
      }, 160);
    },
    [row, leaving, post, onCalled, index, queue.length, resort]
  );

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last || leaving) return;
    setHistory((prev) => prev.slice(0, -1));
    setAskWhy(null);
    setIndex((i) => Math.max(0, i - 1));
    if (last.call === "skip") return;
    setSorted((n) => Math.max(0, n - 1));
    const before = await last.before;
    if (!before) return;
    onCalled(last.row.id, {
      fit: before.fit,
      fit_by: before.fit_by,
      fit_why: before.fit_why,
      tags: before.tags,
      ...(last.call === "blacklist" ? { blacklisted: false } : {}),
    });
    await post({ action: "fit_undo", item_id: last.row.id, call: last.call, before }).catch((err) =>
      setError(err instanceof Error ? err.message : "Could not undo that.")
    );
  }, [history, leaving, post, onCalled]);

  const giveReason = useCallback(
    (reason: string) => {
      if (!askWhy || !reason.trim()) return;
      setAskWhy({ ...askWhy, picked: reason });
      void post({ action: "fit_reason", item_id: askWhy.row.id, reason }).catch(() => null);
      onCalled(askWhy.row.id, { fit_why: reason });
    },
    [askWhy, post, onCalled]
  );

  const close = useCallback(() => {
    // Closing part-way still teaches Ava once there are enough calls to learn from.
    if (sorted >= 10) void resort();
    onClose(resortedRef.current || sorted >= 10);
  }, [sorted, resort, onClose]);

  const more = useCallback(() => {
    const done = new Set([...seen, ...queue.map((r) => r.id)]);
    setSeen(done);
    setQueue(fitQueue(rows, done));
    setIndex(0);
    setHistory([]);
    setAskWhy(null);
    resortedRef.current = false;
  }, [seen, queue, rows]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (e.key === "Escape") target.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "escape") return close();
      if (key === "z" || key === "backspace") {
        e.preventDefault();
        return void undo();
      }
      if (askWhy && !askWhy.picked && /^[1-5]$/.test(key)) return giveReason(REASONS[Number(key) - 1]!);
      if (finished) return;
      const call: Move | null =
        key === "arrowright"
          ? "good"
          : key === "arrowleft"
            ? "bad"
            : key === "arrowup"
              ? "vip"
              : key === "b"
                ? "blacklist"
                : key === " "
                  ? "skip"
                  : null;
      if (call) {
        e.preventDefault();
        decide(call);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, undo, decide, askWhy, giveReason, finished]);

  // No page scroll behind the screen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("a, button, input")) return;
    start.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }
  function onPointerUp() {
    const d = drag;
    start.current = null;
    if (!d) return;
    if (d.x > SWIPE_PX && Math.abs(d.x) > Math.abs(d.y)) decide("good");
    else if (d.x < -SWIPE_PX && Math.abs(d.x) > Math.abs(d.y)) decide("bad");
    else if (d.y < -SWIPE_PX) decide("vip");
    else setDrag(null);
  }

  const hint: Move | null = drag
    ? drag.x > 40 && Math.abs(drag.x) > Math.abs(drag.y)
      ? "good"
      : drag.x < -40 && Math.abs(drag.x) > Math.abs(drag.y)
        ? "bad"
        : drag.y < -40
          ? "vip"
          : null
    : leaving;

  const transform = leaving
    ? leaving === "good"
      ? "translate(120%, 0) rotate(12deg)"
      : leaving === "bad"
        ? "translate(-120%, 0) rotate(-12deg)"
        : leaving === "vip"
          ? "translate(0, -120%)"
          : leaving === "skip"
            ? "translate(0, 24px)"
            : "translate(0, 120%)"
    : drag
      ? `translate(${drag.x}px, ${Math.min(0, drag.y)}px) rotate(${drag.x / 25}deg)`
      : undefined;

  const left = useMemo(() => {
    const done = new Set([...seen, ...queue.map((r) => r.id)]);
    return fitQueue(rows, done, 1).length > 0;
  }, [rows, seen, queue]);

  const card = row ? cards[row.id] : undefined;
  const name = row ? poolDisplayName(row) || row.full_name : "";
  const ava = row?.fit && row.fit_by === "ava" ? fitOption(row.fit) : null;
  const company = card?.company ?? null;
  const staff =
    company?.employeeCount != null
      ? `${company.employeeCount.toLocaleString("en-GB")} staff`
      : company?.employeeRange || row?.team_size
        ? `${(company?.employeeRange || row?.team_size || "").replace(/\s*to\s*|-/, "–")} staff`
        : null;
  const place = company?.headOffice || row?.city || placeOf(card?.location || row?.location);
  const industry = company?.industry || row?.industry || null;
  const website = company?.website || row?.website || null;
  const description = company?.description ?? null;
  const summary = company?.summary || null;
  const about = card?.about ?? null;
  const openPart = opened && row && opened.id === row.id ? opened.part : null;
  const photo = card?.photoUrl && photoFailed !== row?.id ? card.photoUrl : null;
  const facts = [
    staff ? { icon: Users, text: staff } : null,
    place ? { icon: MapPin, text: place } : null,
    industry ? { icon: Factory, text: industry } : null,
  ].filter((f): f is { icon: typeof Users; text: string } => Boolean(f));

  const tally = (["good", "vip", "bad", "blacklist", "skip"] as const)
    .map((c) => ({ c, n: history.filter((h) => h.call === c).length }))
    .filter((t) => t.n)
    .map((t) => `${t.n} ${CALL_WORD[t.c]}`);

  const screen = (
    <div
      ref={overlayRef}
      className="glass-modal fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Check fit"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="glass-modal-scrim" aria-hidden />
      <div className="glass-modal-panel flex h-full max-h-[820px] w-full max-w-3xl flex-col overflow-hidden rounded-[28px]">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
        <button type="button" onClick={() => void undo()} disabled={!history.length} className={buttonClass("quiet", "small")} title="Undo (Z)">
          <Undo2 className="h-4 w-4" aria-hidden />
          Undo
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold text-slate-900">Check fit</p>
          <p className="text-xs tabular-nums text-slate-500">
            {finished ? `${sorted} sorted` : `${index + 1} of ${queue.length}`}
            {tally.length ? <span> · {tally.join(" · ")}</span> : null}
          </p>
        </div>
        <button type="button" onClick={close} className={buttonClass("quiet", "small")} title="Close (Esc)">
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="mx-4 h-1 overflow-hidden rounded-full bg-slate-900/10 sm:mx-6">
        <div className="h-full bg-sky-600 transition-all" style={{ width: `${queue.length ? (Math.min(index, queue.length) / queue.length) * 100 : 0}%` }} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-hidden px-3 py-5 sm:px-8">
        {error ? <p className="mb-2 text-xs text-rose-700">{error}</p> : null}

        {finished ? (
          <div className="mt-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-lg font-semibold text-slate-900">{sorted ? `You sorted ${sorted}.` : "Nobody left to sort here."}</p>
            <p className="mt-2 text-sm text-slate-600">
              {sorted
                ? resorting
                  ? "Asking Ava to re-sort the rest…"
                  : "Ava is now re-sorting everyone else on this list the way you did. It takes a few minutes. Your own calls never change."
                : "Everyone has a call from you already, or is on the blacklist."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {left ? (
                <button type="button" onClick={more} className={buttonClass("main")}>
                  Sort {FIT_ROUND} more
                </button>
              ) : null}
              <button type="button" onClick={close} className={buttonClass("second")}>
                Done
              </button>
            </div>
          </div>
        ) : row ? (
          <div
            key={row.id}
            className="relative max-h-full min-h-0 w-full max-w-2xl touch-none select-none overflow-y-auto px-2 pb-2 sm:px-4"
            style={{ transform, transition: drag && !leaving ? "none" : "transform 160ms ease-out" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              start.current = null;
              setDrag(null);
            }}
          >
            {hint && hint !== "skip" ? (
              <span
                className={`pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 -rotate-6 rounded-lg border-4 bg-white/90 px-4 py-1 text-2xl font-bold uppercase tracking-wide ${STAMP[hint]}`}
              >
                {CALL_WORD[hint]}
              </span>
            ) : null}

            {/* 1. The business: name, then Ava's plain line on what it does. */}
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">
              {company?.name || row.company || "No company named"}
            </h2>
            {summary ? (
              <p className="mt-2 text-lg font-medium leading-snug text-slate-800 sm:text-xl">{summary}</p>
            ) : description ? (
              <p className={`mt-2 whitespace-pre-line text-base leading-relaxed text-slate-800 sm:text-lg ${openPart === "business" ? "" : "line-clamp-3"}`}>
                {description}
              </p>
            ) : card === undefined ? (
              <div className="mt-3 space-y-2.5" aria-hidden>
                <div className="h-5 w-11/12 animate-pulse rounded bg-slate-900/10" />
                <div className="h-5 w-2/3 animate-pulse rounded bg-slate-900/10" />
              </div>
            ) : (
              <p className="mt-2 text-base text-slate-500">No description on LinkedIn or their website.</p>
            )}
            {description && (summary || description.length > DESC_SHORT) ? (
              <button
                type="button"
                onClick={() => setOpened(openPart === "business" ? null : { id: row.id, part: "business" })}
                className="mt-1.5 text-sm font-medium text-[#0c5290] hover:underline"
              >
                {openPart === "business" ? "Hide what they say" : summary ? "What they say about themselves" : "More"}
              </button>
            ) : null}
            {summary && description && openPart === "business" ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{description}</p>
            ) : null}

            {/* 2. Size and place, one line. */}
            {facts.length || website ? (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-800">
                {facts.map((fact) => (
                  <span key={fact.text} className="flex min-w-0 items-center gap-1.5">
                    <fact.icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    {fact.text}
                  </span>
                ))}
                {website ? (
                  <a
                    href={siteHref(website)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1.5 text-[#0c5290] hover:underline"
                  >
                    <Globe className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{siteLabel(website)}</span>
                  </a>
                ) : null}
              </div>
            ) : null}

            {/* 3. The person, with their About on show. */}
            <div className="mt-6 border-t border-slate-900/10 pt-5">
              <div className="flex items-center gap-3">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- LinkedIn CDN photo, sized here
                  <img
                    src={photo}
                    alt=""
                    draggable={false}
                    onError={() => setPhotoFailed(row.id)}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#d8eee4] text-base font-semibold text-[#1f5c43]">
                    {initials(name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-slate-900">{name}</p>
                  <p className="text-sm text-slate-600">
                    {row.job_title || "Role not given"}
                    {card?.tenure ? <span className="font-semibold text-slate-900"> · {card.tenure}</span> : null}
                  </p>
                </div>
                {row.linkedin_url ? (
                  <a
                    href={row.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-md p-2 text-[#0a66c2] hover:bg-white/70"
                    title="Open on LinkedIn"
                  >
                    <LinkedInSolidIcon className="h-6 w-6" />
                    <span className="sr-only">Open on LinkedIn</span>
                  </a>
                ) : null}
              </div>
              {about ? (
                <>
                  <p className={`mt-3 whitespace-pre-line text-base leading-relaxed text-slate-700 ${openPart === "person" ? "" : "line-clamp-5"}`}>
                    {about}
                  </p>
                  {about.length > ABOUT_SHORT ? (
                    <button
                      type="button"
                      onClick={() => setOpened(openPart === "person" ? null : { id: row.id, part: "person" })}
                      className="mt-1 text-sm font-medium text-[#0c5290] hover:underline"
                    >
                      {openPart === "person" ? "Less" : "More"}
                    </button>
                  ) : null}
                </>
              ) : card !== undefined ? (
                <p className="mt-3 text-sm text-slate-500">No About on their LinkedIn.</p>
              ) : null}
            </div>

            {/* 4. Ava's view, quiet. */}
            {ava ? (
              <p className="mt-5 flex items-start gap-2 text-sm text-slate-600">
                <span className={badgeClass(ava.tone, "shrink-0")}>Ava: {ava.short}</span>
                <span className="pt-0.5">{row.fit_why}</span>
              </p>
            ) : null}
          </div>
        ) : null}

      </div>

      {!finished && row ? (
        <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:px-6 sm:pb-6">
          {askWhy ? (
            <div className="mx-auto mb-3 flex max-w-2xl items-center gap-2 overflow-x-auto whitespace-nowrap text-xs">
              {askWhy.picked ? (
                <span className="text-slate-500">
                  Saved why {(poolDisplayName(askWhy.row) || askWhy.row.full_name).split(" ")[0]} was out: {askWhy.picked}
                </span>
              ) : (
                <>
                  <span className="shrink-0 text-slate-500">Why not {(poolDisplayName(askWhy.row) || askWhy.row.full_name).split(" ")[0]}?</span>
                  {REASONS.map((reason, i) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => giveReason(reason)}
                      className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span className="mr-1 hidden text-slate-400 sm:inline">{i + 1}</span>
                      {reason}
                    </button>
                  ))}
                  <form
                    className="shrink-0"
                    onSubmit={(e) => {
                      e.preventDefault();
                      giveReason(other);
                    }}
                  >
                    <input
                      value={other}
                      onChange={(e) => setOther(e.target.value)}
                      placeholder="Other…"
                      aria-label="Another reason"
                      maxLength={160}
                      className={fieldClass("input", "small", "w-32")}
                    />
                  </form>
                </>
              )}
            </div>
          ) : null}
          <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1.5 sm:gap-2">
            {MOVES.map(({ move, icon: Icon, key, title, hover }) => (
              <button
                key={move}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  decide(move);
                }}
                className={`${CALL_BUTTON} ${TALLY[move]} ${hover}`}
                title={title}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {CALL_WORD[move]}
                <span className="hidden text-[10px] font-normal leading-3 opacity-60 sm:block">{key}</span>
              </button>
            ))}
          </div>
          <p className="mx-auto mt-2 max-w-xl text-center text-xs text-slate-500 sm:hidden">Swipe right Good, left Bad, up VIP</p>
        </div>
      ) : null}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(screen, document.body) : null;
}
