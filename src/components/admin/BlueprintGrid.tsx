"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, ChevronRight, Loader2, MessageSquare, Pin, X } from "lucide-react";

import { STATUS_LABEL, STATUS_LOOK } from "@/components/practice/document/statusLook";
import { CommentItem, commentWhen } from "@/components/practice/comments/SectionCommentsUI";
import { ProfitCoachAiMarkdown } from "@/components/profitCoachAi/ProfitCoachAiMarkdown";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { SectionRef } from "@/lib/practiceKnowledge/blueprint";
import {
  adminPageHref,
  adminSectionHref,
  gridCounts,
  gridPageCounts,
  gridPages,
  type GridCell,
  type GridCoach,
  type GridPage,
  type SectionPreview,
} from "@/lib/practiceKnowledge/blueprintGrid";
import type { SectionComment } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { supabaseClient } from "@/lib/supabaseClient";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";

type Detail = { previews: Record<string, SectionPreview>; comments: SectionComment[] };
type DetailState = Detail | "loading" | "error";
type Filter = "all" | "bca" | "unread";
type Sort = "bca" | "name" | "progress";
type Target =
  | { kind: "section"; coachId: string; key: string; rect: DOMRect }
  | { kind: "page"; coachId: string; slug: string; rect: DOMRect };

const OPEN_DELAY_MS = 280;
/** Hover on the chapter cell, not a single dot: wait longer, then show the page. */
const PAGE_OPEN_DELAY_MS = 520;
/** Once a card is showing, moving to the next cell swaps it quickly. */
const SWAP_DELAY_MS = 90;
const CLOSE_DELAY_MS = 160;
const CARD_WIDTH = 380;
const PAGE_CARD_WIDTH = 540;
const COLLAPSE_KEY = "admin-blueprint-grid-collapsed-v2";
/** Wrapped section labels: wide enough for a short title, two or three lines for a long one. */
const COL_W = "w-[4.25rem] min-w-[4.25rem] max-w-[4.25rem]";
const WRAP = "whitespace-normal [overflow-wrap:normal] [word-break:normal]";
const DOT = "h-3.5 w-3.5 rounded-[3px]";
const SQUARE = "h-[18px] w-[18px] rounded-[4px]";

function loadCollapsed(fallback: string[]): string[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : fallback;
  } catch {
    return fallback;
  }
}

function saveCollapsed(slugs: Set<string>) {
  window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...slugs]));
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || name;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

async function adminHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
}

async function fetchGrid(): Promise<{ coaches: GridCoach[] } | { error: string }> {
  const headers = await adminHeaders();
  if (!headers) return { error: "Not signed in." };
  const res = await fetch("/api/admin/practice/grid", { headers }).catch(() => null);
  const body = res ? ((await res.json().catch(() => ({}))) as { coaches?: GridCoach[]; error?: string }) : {};
  if (!res?.ok) return { error: body.error ?? "Could not load the Blueprint overview." };
  return { coaches: body.coaches ?? [] };
}

/** The count beside a filter: quiet, red for new comments, see-through on the chosen filter. */
function countChip(selected: boolean, id: Filter): string {
  if (selected) return "bg-white/20 text-white";
  if (id === "unread") return "bg-rose-500 text-white";
  return "bg-slate-100 text-slate-700";
}

function cellColour(cell: GridCell | undefined): string {
  if (!cell || !cell.tracked) return "bg-slate-100 ring-1 ring-inset ring-slate-200";
  if (cell.status === "done") return "bg-emerald-400";
  if (cell.owner === "bca") return "bg-sky-400";
  if (cell.status === "review") return "bg-amber-300";
  return "bg-rose-400";
}

function cellStatusLabel(cell: GridCell): string {
  if (cell.owner === "bca" && cell.status === "todo") return "BCA to do";
  return STATUS_LABEL[cell.status];
}

const BCA_TODO_LOOK = {
  pill: "bg-sky-200 text-sky-950 ring-sky-300",
  Icon: STATUS_LOOK.todo.Icon,
  stroke: STATUS_LOOK.todo.stroke,
};

function cellLook(cell: GridCell | undefined) {
  if (!cell?.tracked) return null;
  if (cell.owner === "bca" && cell.status === "todo") return BCA_TODO_LOOK;
  return STATUS_LOOK[cell.status];
}

function ownerLine(cell: GridCell | undefined, coachName: string): string {
  if (!cell || !cell.tracked) return "Optional, nothing in it yet";
  if (cell.status === "done") return "Signed off";
  return cell.owner === "bca" ? "Waiting on BCA" : `Waiting on ${firstName(coachName)}`;
}

function Avatar({ name, url, size = "h-7 w-7" }: { name: string; url: string | null; size?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-[#e0f2fe] text-caption font-bold text-[#075985]`}>
      {initials(name)}
    </span>
  );
}

function FieldsPreview({ preview }: { preview: Extract<SectionPreview, { kind: "fields" }> }) {
  if (!preview.fields.length) return <p className="text-ui text-slate-500">Nothing is stored in this section.</p>;
  return (
    <div className="space-y-3">
      {preview.fields.map((field) => (
        <div key={field.label}>
          <p className="text-kicker font-semibold uppercase text-slate-500">{field.label}</p>
          {!field.filled ? (
            <p className={`mt-0.5 text-ui ${field.required ? "font-medium text-rose-700" : "text-slate-400"}`}>
              {field.required ? "Not answered yet" : "Optional, empty"}
            </p>
          ) : field.values.length === 1 ? (
            <p className="mt-0.5 whitespace-pre-wrap text-ui leading-5 text-slate-800">{field.values[0]}</p>
          ) : (
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-ui leading-5 text-slate-800">
              {field.values.map((value, i) => (
                <li key={i}>{value}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ElementDots({ preview }: { preview: SectionPreview | undefined }) {
  if (!preview || preview.kind !== "fields" || preview.fields.length < 2) return null;
  const answered = preview.fields.filter((f) => f.filled).length;
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1">
        {preview.fields.map((field) => (
          <span
            key={field.label}
            title={`${field.label}: ${field.filled ? "answered" : field.required ? "needed" : "optional"}`}
            className={`h-2 w-2 rounded-full ${field.filled ? "bg-emerald-500" : field.required ? "bg-rose-500" : "bg-slate-300"}`}
          />
        ))}
      </span>
      <span className="text-caption text-slate-500">
        {answered} of {preview.fields.length} answered
      </span>
    </div>
  );
}

function CellCard({
  coach,
  sectionRef,
  detail,
  pinned,
  style,
  onPin,
  onClose,
  onEnter,
  onLeave,
  onPosted,
  onRead,
}: {
  coach: GridCoach;
  sectionRef: SectionRef;
  detail: DetailState | undefined;
  pinned: boolean;
  style: CSSProperties;
  onPin: () => void;
  onClose: () => void;
  onEnter: () => void;
  onLeave: () => void;
  onPosted: (comment: SectionComment) => void;
  onRead: () => void;
}) {
  const { key, page, section } = sectionRef;
  const cell = coach.cells[key];
  const thread = coach.threads[key];
  const look = cellLook(cell);
  const loaded = detail && detail !== "loading" && detail !== "error" ? detail : null;
  const preview = loaded?.previews[key];
  const comments = loaded ? loaded.comments.filter((c) => c.section_key === key) : [];
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unread = thread?.unread ?? 0;

  // Pinning the card is reading it: clear the badge.
  useEffect(() => {
    if (pinned && unread > 0) onRead();
  }, [pinned, unread, onRead]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const headers = await getCoachAuthHeaders(coach.coach_id);
      if (!headers) throw new Error("Not signed in.");
      const res = await fetch("/api/coach/practice/comments", {
        method: "POST",
        headers,
        body: JSON.stringify({ section_key: key, body }),
      });
      const data = (await res.json().catch(() => null)) as { comment?: SectionComment; error?: string } | null;
      if (!res.ok || !data?.comment) throw new Error(data?.error || "Could not send.");
      onPosted(data.comment);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={`${coach.name}: ${section.title}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={style}
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45),0_2px_6px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-kicker font-semibold uppercase text-slate-500">{page.title}</p>
          <h3 className="text-ui font-semibold leading-snug text-slate-900">{section.title}</h3>
        </div>
        {look && cell?.tracked ? (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ring-1 ring-inset ${look.pill}`}>
            <look.Icon className="h-3 w-3" strokeWidth={look.stroke} aria-hidden />
            {cellStatusLabel(cell)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={pinned ? onClose : onPin}
          aria-label={pinned ? "Close" : "Keep open"}
          title={pinned ? "Close" : "Keep open"}
          className="-mr-1 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {pinned ? <X className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-3 text-caption text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={coach.name} url={coach.avatar_url} size="h-5 w-5" />
          <span className="font-medium text-slate-800">{coach.name}</span>
        </span>
        <span className={cell?.owner === "bca" && cell.status !== "done" ? "font-medium text-[#0c5290]" : ""}>
          {ownerLine(cell, coach.name)}
        </span>
        {cell?.revision ? <span className="text-slate-400">Updated {commentWhen(cell.revision).toLowerCase()}</span> : null}
      </div>
      <div className="px-4 pt-2">
        <ElementDots preview={preview} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {detail === "error" ? (
          <p className="text-ui text-rose-700">Could not load this section.</p>
        ) : !preview ? (
          <p className="flex items-center gap-2 text-ui text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading
          </p>
        ) : preview.kind === "fields" ? (
          <FieldsPreview preview={preview} />
        ) : preview.markdown ? (
          <div className="text-ui leading-5 text-slate-800">
            <ProfitCoachAiMarkdown content={preview.markdown} />
            {preview.written_at ? (
              <p className="mt-2 text-caption text-slate-400">
                Written {commentWhen(preview.written_at).toLowerCase()}
                {preview.edited_at ? `, edited ${commentWhen(preview.edited_at).toLowerCase()}` : ""}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-ui text-slate-500">Not written yet.</p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-kicker font-semibold uppercase text-slate-500">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              Comments{comments.length ? ` (${comments.length})` : ""}
              {unread && !pinned ? (
                <span className="rounded-full bg-rose-500 px-1.5 text-caption font-bold normal-case tracking-normal text-white">{unread} new</span>
              ) : null}
            </p>
            {comments.length ? (
              <ol className="space-y-2.5">
                {comments.length > 3 ? <li className="text-caption text-slate-400">{comments.length - 3} earlier</li> : null}
                {comments.slice(-3).map((comment) => (
                  <CommentItem key={comment.id} comment={comment} mine={comment.author_side === "bca"} compact />
                ))}
              </ol>
            ) : null}
            <div className="mt-2.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={onPin}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder={`Write to ${firstName(coach.name)} about this section`}
                className="block w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-ui leading-5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1a8fd4] focus:ring-2 focus:ring-[#cfe6f8]"
              />
              <div className="mt-1.5 flex items-center justify-between">
                {error ? <span className="text-caption text-rose-700">{error}</span> : <span />}
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  className={buttonClass("main", "small")}
                >
                  {sending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                  Send
                </button>
              </div>
            </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-caption">
        <Link href={adminSectionHref(page, key, coach.coach_id)} className="inline-flex items-center gap-1 font-medium text-[#0c5290] hover:underline">
          Open section
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {pinned ? (
          <Link href={adminSectionHref(page, key, coach.coach_id, true)} className="font-medium text-slate-600 hover:text-slate-900 hover:underline">
            Full thread
          </Link>
        ) : (
          <span className="text-slate-400">Click the square to keep this open</span>
        )}
      </div>
    </div>
  );
}

function cellLabel(coach: GridCoach, ref: { key: string; section: { title: string } }) {
  const cell = coach.cells[ref.key];
  const thread = coach.threads[ref.key];
  return `${coach.name}, ${ref.section.title}: ${cell?.tracked ? cellStatusLabel(cell) : "Optional"}${
    thread?.unread ? `, ${thread.unread} new comment${thread.unread === 1 ? "" : "s"}` : ""
  }`;
}

function StatusMark({
  cell,
  unread,
  size,
  active,
}: {
  cell: GridCell | undefined;
  unread: number;
  size: "dot" | "square";
  active?: boolean;
}) {
  const box = size === "dot" ? DOT : SQUARE;
  return (
    <span className={`relative block ${box} shrink-0 ${cellColour(cell)} ${active ? "ring-2 ring-[#0c5290]" : ""}`}>
      {unread ? (
        <span
          className={`pointer-events-none absolute rounded-full bg-rose-600 ${
            size === "dot" ? "-right-0.5 -top-0.5 h-1.5 w-1.5 ring-1 ring-white" : "-right-1 -top-1 h-2.5 w-2.5 ring-2 ring-white"
          }`}
        />
      ) : null}
    </span>
  );
}

function PreviewBody({ preview, detail }: { preview: SectionPreview | undefined; detail: DetailState | undefined }) {
  if (detail === "error") return <p className="text-ui text-rose-700">Could not load this section.</p>;
  if (!preview) {
    return (
      <p className="flex items-center gap-2 text-ui text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading
      </p>
    );
  }
  if (preview.kind === "fields") return <FieldsPreview preview={preview} />;
  if (preview.markdown) {
    return (
      <div className="text-ui leading-5 text-slate-800">
        <ProfitCoachAiMarkdown content={preview.markdown} />
        {preview.written_at ? (
          <p className="mt-2 text-caption text-slate-400">
            Written {commentWhen(preview.written_at).toLowerCase()}
            {preview.edited_at ? `, edited ${commentWhen(preview.edited_at).toLowerCase()}` : ""}
          </p>
        ) : null}
      </div>
    );
  }
  return <p className="text-ui text-slate-500">Not written yet.</p>;
}

function PageCard({
  coach,
  page,
  detail,
  pinned,
  style,
  onPin,
  onClose,
  onEnter,
  onLeave,
}: {
  coach: GridCoach;
  page: GridPage;
  detail: DetailState | undefined;
  pinned: boolean;
  style: CSSProperties;
  onPin: () => void;
  onClose: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const loaded = detail && detail !== "loading" && detail !== "error" ? detail : null;
  const n = gridPageCounts(
    coach,
    page.sections.map((ref) => ref.key)
  );
  return (
    <div
      role="dialog"
      aria-label={`${coach.name}: ${page.title}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={style}
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45),0_2px_6px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-kicker font-semibold uppercase text-slate-500">
            {n.done} of {n.tracked || page.sections.length} done
            {n.bca ? ` · ${n.bca} with BCA` : ""}
          </p>
          <h3 className="text-ui font-semibold leading-snug text-slate-900">{page.title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-caption text-slate-600">
          <Avatar name={coach.name} url={coach.avatar_url} size="h-5 w-5" />
          <span className="font-medium text-slate-800">{coach.name}</span>
        </span>
        <button
          type="button"
          onClick={pinned ? onClose : onPin}
          aria-label={pinned ? "Close" : "Keep open"}
          title={pinned ? "Close" : "Keep open"}
          className="-mr-1 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {pinned ? <X className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {page.sections.map((ref) => {
          const cell = coach.cells[ref.key];
          const look = cellLook(cell);
          return (
            <section key={ref.key} className="border-b border-slate-100 py-3 first:pt-0 last:border-b-0 last:pb-0">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h4 className="text-ui font-semibold text-slate-900">{ref.section.title}</h4>
                {look && cell?.tracked ? (
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ring-1 ring-inset ${look.pill}`}>
                    <look.Icon className="h-3 w-3" strokeWidth={look.stroke} aria-hidden />
                    {cellStatusLabel(cell)}
                  </span>
                ) : (
                  <span className="text-caption text-slate-400">Optional</span>
                )}
              </div>
              <PreviewBody preview={loaded?.previews[ref.key]} detail={detail} />
            </section>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-caption">
        <Link href={adminPageHref(page.slug, coach.coach_id)} className="inline-flex items-center gap-1 font-medium text-[#0c5290] hover:underline">
          Open page
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <span className="text-slate-400">{pinned ? "Click the cell again to close" : "Hover the cell, not a dot, to open this"}</span>
      </div>
    </div>
  );
}

function PageDots({
  page,
  coach,
  target,
  onHover,
  onLeave,
  onClick,
  onPageHover,
  onPageClick,
}: {
  page: GridPage;
  coach: GridCoach;
  target: Target | null;
  onHover: (key: string, el: HTMLElement) => void;
  onLeave: () => void;
  onClick: (key: string, el: HTMLElement) => void;
  onPageHover: (el: HTMLElement) => void;
  onPageClick: (el: HTMLElement) => void;
}) {
  const pageActive = target?.kind === "page" && target.coachId === coach.coach_id && target.slug === page.slug;
  return (
    <td
      data-grid-page
      className={`border-b border-l border-slate-200 px-1 py-1 text-center align-middle group-hover:bg-slate-50 ${
        pageActive ? "bg-sky-50/70" : ""
      }`}
      onMouseEnter={(e) => onPageHover(e.currentTarget)}
      onMouseLeave={onLeave}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-grid-cell]")) return;
        onPageClick(e.currentTarget);
      }}
    >
      <div className="flex h-[18px] items-center justify-center gap-px">
        {page.sections.map((ref) => {
          const cell = coach.cells[ref.key];
          const unread = coach.threads[ref.key]?.unread ?? 0;
          const active = target?.kind === "section" && target.coachId === coach.coach_id && target.key === ref.key;
          return (
            <button
              key={ref.key}
              type="button"
              data-grid-cell
              title={ref.section.title}
              aria-label={cellLabel(coach, ref)}
              onMouseEnter={(e) => {
                e.stopPropagation();
                onHover(ref.key, e.currentTarget);
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                onPageHover(e.currentTarget.closest("td") ?? e.currentTarget);
              }}
              onFocus={(e) => onHover(ref.key, e.currentTarget)}
              onBlur={onLeave}
              onClick={(e) => {
                e.stopPropagation();
                onClick(ref.key, e.currentTarget);
              }}
              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center p-0 leading-none hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0c5290]"
            >
              <StatusMark cell={cell} unread={unread} size="dot" active={active} />
            </button>
          );
        })}
      </div>
    </td>
  );
}

/** Coaches → Blueprint: every coach's sections as coloured squares, with the section on hover. */
export function BlueprintGrid() {
  const pages = useMemo(() => gridPages(), []);
  const columns = useMemo(() => pages.flatMap((p) => p.sections), [pages]);
  const [coaches, setCoaches] = useState<GridCoach[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("bca");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(pages.map((page) => page.slug)));
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [target, setTarget] = useState<Target | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hotKey, setHotKey] = useState<string | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** Coaches whose sections have been asked for, so a sweep across a row fetches once. */
  const requested = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    const refresh = () => {
      void fetchGrid().then((result) => {
        if (!live) return;
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setError(null);
        setCoaches(result.coaches);
      });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    setCollapsed(new Set(loadCollapsed(pages.map((page) => page.slug))));
  }, [pages]);

  const applyCollapsed = useCallback((next: Set<string>) => {
    setCollapsed(next);
    saveCollapsed(next);
  }, []);

  const setPagesOpen = useCallback(
    (open: boolean) => {
      applyCollapsed(open ? new Set() : new Set(pages.map((page) => page.slug)));
    },
    [applyCollapsed, pages]
  );

  const ensureDetail = useCallback(async (coachId: string) => {
    if (requested.current.has(coachId)) return;
    requested.current.add(coachId);
    setDetails((prev) => ({ ...prev, [coachId]: "loading" }));
    const headers = await adminHeaders();
    const res = headers ? await fetch(`/api/admin/practice/grid/${coachId}`, { headers }) : null;
    const body = res ? ((await res.json().catch(() => null)) as Detail | null) : null;
    const ok = Boolean(res?.ok && body);
    // A failed fetch is tried again on the next hover.
    if (!ok) requested.current.delete(coachId);
    setDetails((prev) => ({ ...prev, [coachId]: ok && body ? body : "error" }));
  }, []);

  const clearTimers = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const close = useCallback(() => {
    clearTimers();
    setTarget(null);
    setPinned(false);
  }, []);

  const togglePage = useCallback(
    (slug: string) => {
      const next = new Set(collapsed);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      applyCollapsed(next);
      const page = pages.find((p) => p.slug === slug);
      if (
        target &&
        ((target.kind === "page" && target.slug === slug) ||
          (target.kind === "section" && page?.sections.some((ref) => ref.key === target.key)))
      ) {
        close();
      }
    },
    [applyCollapsed, close, collapsed, pages, target]
  );

  function hoverCell(coachId: string, key: string, el: HTMLElement) {
    if (pinned) return;
    clearTimers();
    void ensureDetail(coachId);
    const rect = el.getBoundingClientRect();
    const delay = target?.kind === "section" ? SWAP_DELAY_MS : OPEN_DELAY_MS;
    openTimer.current = window.setTimeout(() => setTarget({ kind: "section", coachId, key, rect }), delay);
  }

  function hoverPage(coachId: string, slug: string, el: HTMLElement) {
    if (pinned) return;
    clearTimers();
    void ensureDetail(coachId);
    const rect = el.getBoundingClientRect();
    const delay = target?.kind === "page" ? SWAP_DELAY_MS : PAGE_OPEN_DELAY_MS;
    openTimer.current = window.setTimeout(() => setTarget({ kind: "page", coachId, slug, rect }), delay);
  }

  function leaveCell() {
    if (pinned) return;
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    closeTimer.current = window.setTimeout(() => setTarget(null), CLOSE_DELAY_MS);
  }

  function clickCell(coachId: string, key: string, el: HTMLElement) {
    clearTimers();
    if (pinned && target?.kind === "section" && target.coachId === coachId && target.key === key) {
      close();
      return;
    }
    void ensureDetail(coachId);
    setTarget({ kind: "section", coachId, key, rect: el.getBoundingClientRect() });
    setPinned(true);
  }

  function clickPage(coachId: string, slug: string, el: HTMLElement) {
    clearTimers();
    if (pinned && target?.kind === "page" && target.coachId === coachId && target.slug === slug) {
      close();
      return;
    }
    void ensureDetail(coachId);
    setTarget({ kind: "page", coachId, slug, rect: el.getBoundingClientRect() });
    setPinned(true);
  }

  useEffect(() => {
    if (!target) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onDown(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (cardRef.current?.contains(el) || el.closest("[data-grid-cell], [data-grid-page]")) return;
      close();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [target, close]);

  const setThread = useCallback((coachId: string, key: string, change: (t: { total: number; unread: number; last_at: string | null }) => { total: number; unread: number; last_at: string | null }) => {
    setCoaches((prev) =>
      prev
        ? prev.map((c) =>
            c.coach_id === coachId
              ? { ...c, threads: { ...c.threads, [key]: change(c.threads[key] ?? { total: 0, unread: 0, last_at: null }) } }
              : c
          )
        : prev
    );
  }, []);

  const markRead = useCallback(
    (coachId: string, key: string) => {
      setThread(coachId, key, (t) => ({ ...t, unread: 0 }));
      void (async () => {
        const headers = await getCoachAuthHeaders(coachId);
        if (!headers) return;
        await fetch("/api/coach/practice/comments/read", {
          method: "POST",
          headers,
          body: JSON.stringify({ section_key: key }),
        }).catch(() => undefined);
      })();
    },
    [setThread]
  );

  const posted = useCallback(
    (coachId: string, comment: SectionComment) => {
      setThread(coachId, comment.section_key, (t) => ({ total: t.total + 1, unread: 0, last_at: comment.created_at }));
      setDetails((prev) => {
        const have = prev[coachId];
        if (!have || have === "loading" || have === "error") return prev;
        return { ...prev, [coachId]: { ...have, comments: [...have.comments, comment] } };
      });
    },
    [setThread]
  );

  const rows = useMemo(() => {
    if (!coaches) return [];
    const withCounts = coaches.map((coach) => ({ coach, n: gridCounts(coach) }));
    const shown = withCounts.filter(({ n }) => (filter === "bca" ? n.bca > 0 : filter === "unread" ? n.unread > 0 : true));
    const byName = (a: GridCoach, b: GridCoach) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return shown.sort((a, b) => {
      if (sort === "name") return byName(a.coach, b.coach);
      if (sort === "progress") return a.n.done / (a.n.tracked || 1) - b.n.done / (b.n.tracked || 1) || byName(a.coach, b.coach);
      return b.n.unread - a.n.unread || b.n.bca - a.n.bca || byName(a.coach, b.coach);
    });
  }, [coaches, filter, sort]);

  const totals = useMemo(() => {
    const all = (coaches ?? []).map(gridCounts);
    return {
      bca: all.filter((n) => n.bca > 0).length,
      unread: all.filter((n) => n.unread > 0).length,
    };
  }, [coaches]);

  const card = (() => {
    if (!target || !coaches) return null;
    const coach = coaches.find((c) => c.coach_id === target.coachId);
    if (!coach) return null;
    const width = target.kind === "page" ? PAGE_CARD_WIDTH : CARD_WIDTH;
    const maxH = Math.min(target.kind === "page" ? 640 : 580, window.innerHeight * (target.kind === "page" ? 0.82 : 0.75));
    const right = target.rect.right + 10;
    const left = right + width > window.innerWidth - 12 ? Math.max(12, target.rect.left - 10 - width) : right;
    const top = Math.max(12, Math.min(target.rect.top - 48, window.innerHeight - maxH - 12));
    const hold = {
      onEnter: () => {
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      },
      onLeave: () => {
        if (!pinned) leaveCell();
      },
    };
    if (target.kind === "page") {
      const page = pages.find((p) => p.slug === target.slug);
      if (!page) return null;
      return (
        <div ref={cardRef}>
          <PageCard
            key={`${coach.coach_id}:${page.slug}`}
            coach={coach}
            page={page}
            detail={details[coach.coach_id]}
            pinned={pinned}
            style={{ left, top, width, maxHeight: maxH }}
            onPin={() => setPinned(true)}
            onClose={close}
            {...hold}
          />
        </div>
      );
    }
    const sectionRef = columns.find((c) => c.key === target.key);
    if (!sectionRef) return null;
    return (
      <div ref={cardRef}>
        <CellCard
          key={`${coach.coach_id}:${sectionRef.key}`}
          coach={coach}
          sectionRef={sectionRef}
          detail={details[coach.coach_id]}
          pinned={pinned}
          style={{ left, top, width, maxHeight: maxH }}
          onPin={() => setPinned(true)}
          onClose={close}
          onPosted={(comment) => posted(coach.coach_id, comment)}
          onRead={() => markRead(coach.coach_id, sectionRef.key)}
          {...hold}
        />
      </div>
    );
  })();

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All coaches" },
    { id: "bca", label: "Waiting on BCA", count: totals.bca },
    { id: "unread", label: "New comments", count: totals.unread },
  ];

  const anyOpen = pages.some((page) => !collapsed.has(page.slug));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Show" className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-ui font-medium ${
                  filter === f.id ? "bg-[#0c5290] text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f.label}
                {f.count ? (
                  <span className={`rounded-full px-1.5 text-caption font-bold ${countChip(filter === f.id, f.id)}`}>
                    {f.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-ui text-slate-600">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className={fieldClass("select", "small", "w-auto")}
            >
              <option value="bca">Needs us first</option>
              <option value="progress">Least done first</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const opening = collapsed.size === pages.length;
              setPagesOpen(opening);
              if (!opening) close();
            }}
            className="text-ui font-medium text-slate-600 hover:text-slate-900"
          >
            {collapsed.size === pages.length ? "Expand all" : "Collapse all"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-caption text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-rose-400" />To do</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-amber-300" />Review</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-emerald-400" />Done</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-slate-100 ring-1 ring-inset ring-slate-200" />Optional</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-flex h-3 w-3 items-center justify-center rounded-[3px] bg-rose-400"><span className="h-1.5 w-1.5 rounded-full bg-[#0c3a66]" /></span>
            Waiting on BCA
          </span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white" />New comment</span>
        </div>
      </div>

      {error ? <p className="px-4 text-sm text-rose-600 md:px-6">{error}</p> : null}
      {!coaches && !error ? <p className="px-4 text-sm text-slate-600 md:px-6">Loading the Blueprint overview…</p> : null}
      {coaches && !rows.length ? (
        <p className="px-4 text-sm text-slate-600 md:px-6">{coaches.length ? "No coaches match this filter." : "No coach has started a Blueprint yet."}</p>
      ) : null}

      {rows.length ? (
        <div
          className="min-h-0 flex-1 overflow-auto border-t border-slate-200 bg-white"
          onScroll={() => {
            if (!pinned) close();
          }}
        >
          <table className="border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20 bg-slate-50">
              <tr className="text-caption font-semibold text-slate-600">
                <th
                  rowSpan={anyOpen ? 2 : 1}
                  className="sticky left-0 z-30 min-w-[13.5rem] border-b border-r border-slate-200 bg-slate-50 px-3 py-1.5 align-middle text-xs uppercase tracking-wide text-slate-500"
                >
                  Coach
                </th>
                {pages.map((page) => {
                  const open = !collapsed.has(page.slug);
                  return (
                    <th
                      key={page.slug}
                      colSpan={open ? page.sections.length : 1}
                      rowSpan={open || !anyOpen ? 1 : 2}
                      style={open ? undefined : { minWidth: Math.max(112, page.sections.length * 16 + 12) }}
                      className="border-b border-l border-slate-200 bg-slate-50 px-1 py-1.5 text-center align-middle"
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => togglePage(page.slug)}
                        className="relative mx-auto flex w-full max-w-full items-center justify-center px-4 py-0.5 text-center text-caption font-semibold leading-snug text-slate-600 hover:text-slate-900"
                      >
                        <span className={WRAP}>{page.title}</span>
                        <ChevronRight
                          aria-hidden
                          className={`absolute right-0.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
              {anyOpen ? (
              <tr>
                {pages.map((page) =>
                  collapsed.has(page.slug) ? null : (
                    <Fragment key={page.slug}>
                      {page.sections.map((ref, i) => (
                        <th
                          key={ref.key}
                          className={`border-b border-slate-200 bg-slate-50 px-0.5 pb-1.5 pt-0.5 align-bottom ${COL_W} ${i === 0 ? "border-l" : ""}`}
                        >
                          <span
                            className={`block text-center text-caption leading-snug ${WRAP} ${
                              hotKey === ref.key ? "font-semibold text-slate-900" : "font-medium text-slate-500"
                            }`}
                          >
                            {ref.section.title}
                          </span>
                        </th>
                      ))}
                    </Fragment>
                  )
                )}
              </tr>
              ) : null}
            </thead>
            <tbody>
              {rows.map(({ coach, n }) => (
                <tr key={coach.coach_id} className="group" onMouseEnter={() => void ensureDetail(coach.coach_id)}>
                  <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-1 group-hover:bg-slate-50">
                    <Link href={`/admin/blueprint/coach?coach=${coach.coach_id}`} className="flex items-center gap-2.5">
                      <Avatar name={coach.name} url={coach.avatar_url} />
                      <span className="min-w-0">
                        <span className="block truncate text-ui font-medium text-slate-900 hover:underline">{coach.name}</span>
                        <span className="block text-caption text-slate-500">
                          {n.done} of {n.tracked} done
                          {n.bca ? <span className="font-medium text-[#0c5290]"> · {n.bca} with BCA</span> : null}
                          {n.unread ? <span className="font-medium text-rose-600"> · {n.unread} new</span> : null}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {pages.map((page) =>
                    collapsed.has(page.slug) ? (
                      <PageDots
                        key={page.slug}
                        page={page}
                        coach={coach}
                        target={target}
                        onHover={(key, el) => {
                          setHotKey(key);
                          hoverCell(coach.coach_id, key, el);
                        }}
                        onLeave={() => {
                          setHotKey(null);
                          leaveCell();
                        }}
                        onClick={(key, el) => clickCell(coach.coach_id, key, el)}
                        onPageHover={(el) => {
                          setHotKey(null);
                          hoverPage(coach.coach_id, page.slug, el);
                        }}
                        onPageClick={(el) => clickPage(coach.coach_id, page.slug, el)}
                      />
                    ) : (
                      <Fragment key={page.slug}>
                        {page.sections.map((ref, i) => {
                          const cell = coach.cells[ref.key];
                          const unread = coach.threads[ref.key]?.unread ?? 0;
                          const active = target?.kind === "section" && target.coachId === coach.coach_id && target.key === ref.key;
                          return (
                            <td
                              key={ref.key}
                              className={`border-b border-slate-100 px-[2px] py-1 text-center align-middle group-hover:bg-slate-50 ${i === 0 ? "border-l border-l-slate-200" : ""}`}
                            >
                              <button
                                type="button"
                                data-grid-cell
                                aria-label={cellLabel(coach, ref)}
                                onMouseEnter={(e) => {
                                  setHotKey(ref.key);
                                  hoverCell(coach.coach_id, ref.key, e.currentTarget);
                                }}
                                onMouseLeave={() => {
                                  setHotKey(null);
                                  leaveCell();
                                }}
                                onFocus={(e) => hoverCell(coach.coach_id, ref.key, e.currentTarget)}
                                onBlur={leaveCell}
                                onClick={(e) => clickCell(coach.coach_id, ref.key, e.currentTarget)}
                                className="mx-auto inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center p-0 leading-none hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0c5290]"
                              >
                                <StatusMark cell={cell} unread={unread} size="square" active={active} />
                              </button>
                            </td>
                          );
                        })}
                      </Fragment>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {card}
    </div>
  );
}
