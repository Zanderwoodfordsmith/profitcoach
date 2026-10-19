"use client";

import { useCallback, useEffect, useState, type PointerEvent } from "react";
import { prospectInitials } from "@/components/prospects/ProspectTableAvatar";
import type { DeckCard, NetworkRating } from "@/lib/referrals/network";

const SWIPE_DISTANCE = 110;
const EXIT_MS = 180;

function Photo({ name, url, size }: { name: string; url: string | null; size: "lg" | "sm" }) {
  const [failed, setFailed] = useState(false);
  const box = size === "lg" ? "h-28 w-28 text-2xl" : "h-9 w-9 text-[11px]";
  if (!url || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-sky-50 font-semibold text-sky-800 ring-1 ring-inset ring-sky-100 ${box}`}
        aria-hidden
      >
        {prospectInitials(name)}
      </span>
    );
  }
  return (
    // LinkedIn photo links expire; a re-read of the network refreshes them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ring-1 ring-slate-200 ${box}`}
      draggable={false}
    />
  );
}

export { Photo as NetworkPhoto };

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-current/30 px-1.5 py-0.5 font-sans text-[11px] leading-none opacity-70">
      {children}
    </kbd>
  );
}

type Props = {
  card: DeckCard | null;
  nextCard: DeckCard | null;
  canUndo: boolean;
  onRate: (rating: NetworkRating) => void;
  onUndo: () => void;
};

/** One connection at a time: left (←) "Don't know", right (→) "True". */
export function NetworkSwipe({ card, nextCard, canUndo, onRate, onUndo }: Props) {
  const [drag, setDrag] = useState<{ startX: number; dx: number } | null>(null);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);

  const commit = useCallback(
    (rating: NetworkRating) => {
      if (!card || leaving) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setLeaving(rating === "known" ? "right" : "left");
      window.setTimeout(
        () => {
          onRate(rating);
          setLeaving(null);
          setDrag(null);
        },
        reduce ? 0 : EXIT_MS
      );
    },
    [card, leaving, onRate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        commit("unknown");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        commit("known");
      } else if (e.key === "Backspace" && canUndo && !leaving) {
        e.preventDefault();
        onUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, onUndo, canUndo, leaving]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (leaving || (e.target as HTMLElement).closest("a,button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX, dx: 0 });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ ...drag, dx: e.clientX - drag.startX });
  };
  const onPointerUp = () => {
    if (!drag) return;
    if (Math.abs(drag.dx) >= SWIPE_DISTANCE) commit(drag.dx > 0 ? "known" : "unknown");
    else setDrag(null);
  };

  if (!card) return null;

  const dx = leaving ? (leaving === "right" ? 1 : -1) * 640 : drag?.dx ?? 0;
  const tilt = Math.max(-14, Math.min(14, dx / 18));
  const lean = Math.min(1, Math.abs(drag?.dx ?? 0) / SWIPE_DISTANCE);
  const year = card.connectedAt ? new Date(card.connectedAt).getFullYear() : null;

  return (
    <div className="mx-auto w-full max-w-md select-none">
      <div className="relative">
        {nextCard ? (
          <div
            aria-hidden
            className="absolute inset-x-4 -bottom-2 top-2 rounded-2xl border border-slate-200 bg-white/70"
          />
        ) : null}

        <div
          key={card.publicIdentifier}
          role="group"
          aria-label={`${card.name}. Would you recognise each other's names?`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          style={{
            transform: `translateX(${dx}px) rotate(${tilt}deg)`,
            opacity: leaving ? 0 : 1,
            transition: drag && !leaving ? "none" : `transform ${EXIT_MS}ms ease-out, opacity ${EXIT_MS}ms ease-out`,
          }}
          className="relative cursor-grab touch-pan-y rounded-2xl border border-slate-200 bg-white px-6 pb-6 pt-8 text-center shadow-[0_12px_40px_-18px_rgba(12,82,144,0.35)] active:cursor-grabbing motion-reduce:transition-none"
        >
          {drag && drag.dx > 0 ? (
            <span
              style={{ opacity: lean }}
              className="absolute left-4 top-4 rounded-md bg-gradient-to-r from-[#0c5290] to-[#1a8fd4] px-2.5 py-1 text-xs font-semibold text-white"
            >
              True
            </span>
          ) : null}
          {drag && drag.dx < 0 ? (
            <span
              style={{ opacity: lean }}
              className="absolute right-4 top-4 rounded-md bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white"
            >
              Don&apos;t know
            </span>
          ) : null}

          <div className="flex justify-center">
            <Photo name={card.name} url={card.photoUrl} size="lg" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-slate-900">{card.name}</h3>
          {card.headline ? (
            <p className="mx-auto mt-1 line-clamp-3 max-w-sm text-sm text-slate-600">{card.headline}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            {card.onOtherLists > 0 ? (
              <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-800 ring-1 ring-inset ring-sky-100">
                {card.onOtherLists === 1
                  ? "On another member's prospect list"
                  : `On ${card.onOtherLists} members' prospect lists`}
              </span>
            ) : null}
            {year ? <span className="text-slate-500">Connected {year}</span> : null}
            {card.profileUrl ? (
              <a
                href={card.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 underline-offset-2 hover:underline"
              >
                LinkedIn
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-sm font-medium text-slate-700">
        You&apos;d recognise each other&apos;s names
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => commit("unknown")}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Kbd>←</Kbd> Don&apos;t know
        </button>
        <button
          type="button"
          onClick={() => commit("known")}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0c5290] to-[#1a8fd4] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
        >
          True <Kbd>→</Kbd>
        </button>
      </div>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || Boolean(leaving)}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
        >
          Undo <Kbd>⌫</Kbd>
        </button>
      </div>
    </div>
  );
}
