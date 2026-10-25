"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Check, ChevronLeft, ChevronRight, Loader2, MessageSquare, Mic, MoreHorizontal, Pencil, Square, Trash2, UserRound } from "lucide-react";

import { buttonClass } from "@/components/ui/Button";
import { sectionByKey, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { commentCapabilities, COMMENT_MAX_LENGTH, type CommentPerson, type SectionComment } from "@/lib/practiceKnowledge/sectionCommentTypes";
import type { SectionStatusEvent } from "@/lib/practiceKnowledge/types";
import { STATUS_LABEL, type StatusId } from "../document/statusLook";

import { useAutoGrow, useHalfHeight, useVoiceInput } from "../composer";
import { usePractice } from "../PracticeProvider";
import { useSectionComments } from "./SectionCommentsContext";

/** "Just now", "3h ago", "2d ago", then the date. */
export function commentWhen(iso: string): string {
  const at = new Date(iso);
  const minutes = Math.round((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

/** Their picture, or a BCA or Ava mark. */
export function CommentAvatar({ comment, size = "md" }: { comment: SectionComment; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]";
  if (comment.author_side === "ava") {
    return (
      <span aria-hidden className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-[#1a8fd4] font-bold text-white`}>
        Ava
      </span>
    );
  }
  if (comment.author_avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={comment.author_avatar_url} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full font-semibold ${
        comment.author_side === "bca" ? "bg-[#0c5290] text-white" : "bg-[#eaf3fb] text-[#0c5290]"
      }`}
    >
      {comment.author_side === "bca" && !comment.author_name.trim() ? "BCA" : initials(comment.author_name)}
    </span>
  );
}

function SideTag({ comment }: { comment: SectionComment }) {
  if (comment.author_side === "coach") return null;
  return (
    <span className="rounded bg-[#e3eef8] px-1 text-caption font-semibold tracking-[0.04em] text-[#0c5290]">
      {comment.author_side === "ava" ? "AI" : "BCA"}
    </span>
  );
}

/** One comment as a compact line. Plain colours, so it also works on the admin overview. */
export function CommentItem({ comment, mine, compact = false }: { comment: SectionComment; mine: boolean; compact?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <CommentAvatar comment={comment} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-ui leading-5">
          <span className="font-medium text-[#0b1b2e]">{mine ? "You" : comment.author_name}</span>
          <SideTag comment={comment} />
          <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString("en-GB")} className="text-xs text-[#8595a8]">
            {commentWhen(comment.created_at)}
          </time>
        </p>
        <p className={`whitespace-pre-wrap break-words text-[#1e2f44] ${compact ? "text-ui leading-5" : "mt-0.5 text-read"}`}>
          {comment.body}
        </p>
      </div>
    </li>
  );
}

/** The comment icon on a section header. Bright with a count when something is waiting for you. */
export function CommentButton({ sectionKey, title }: { sectionKey: string; title: string }) {
  const comments = useSectionComments();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const linked = Boolean(comments?.side) && comments?.linkedKey === sectionKey;

  // A link or the comments list names this thread: scroll its section into view once it is drawn.
  // A frame later, so it lands after the page's own scroll back to the top.
  useEffect(() => {
    if (!linked) return;
    const frame = window.requestAnimationFrame(() => {
      buttonRef.current?.closest("section")?.scrollIntoView({ block: "start", behavior: "smooth" });
      comments?.clearLinked();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [linked, comments]);

  if (!comments?.side) return null;
  const thread = comments.threads[sectionKey];
  const unread = thread?.unread ?? 0;
  const total = thread?.total ?? 0;
  const open = comments.openKey === sectionKey;
  const label = unread
    ? `${title}: ${unread} new comment${unread === 1 ? "" : "s"}`
    : total
      ? `${title}: ${total} comment${total === 1 ? "" : "s"}`
      : `Comment on ${title}`;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => comments.toggle(sectionKey)}
      aria-expanded={open}
      aria-label={label}
      title={label}
      className={`relative inline-flex h-7 items-center gap-1 rounded-full px-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bp-tint)] ${
        open ? "bg-[var(--bp-tint)] text-[var(--bp-ink)]" : unread || total ? "text-[var(--bp-ink)]" : "text-[var(--bp-faint)] hover:text-[var(--bp-ink)]"
      }`}
    >
      <MessageSquare className="h-4 w-4" strokeWidth={unread ? 2.25 : 1.75} aria-hidden />
      {total && !unread ? <span className="tabular-nums">{total}</span> : null}
      {unread ? (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          {unread}
        </span>
      ) : null}
    </button>
  );
}

/** "Comments" beside "Talk it through" at the top of a page: opens the list of every conversation. */
export function CommentsButton() {
  const comments = useSectionComments();
  if (!comments?.side) return null;
  const unread = Object.values(comments.threads).reduce((n, t) => n + t.unread, 0);
  return (
    <button
      type="button"
      onClick={comments.openList}
      className={buttonClass("second", "small", "bp-no-print relative shrink-0")}
    >
      <MessageSquare className="h-4 w-4" aria-hidden />
      Comments
      {unread ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
          {unread}
        </span>
      ) : null}
    </button>
  );
}

/** Unread comments across one Blueprint page, for the sidebar. */
export function PageCommentBadge({ pageSlug }: { pageSlug: string }) {
  const comments = useSectionComments();
  if (!comments?.side) return null;
  let unread = 0;
  for (const [key, thread] of Object.entries(comments.threads)) {
    if (thread.unread && sectionByKey(key)?.page.slug === pageSlug) unread += thread.unread;
  }
  if (!unread) return null;
  return (
    <span
      title={`${unread} new comment${unread === 1 ? "" : "s"}`}
      className="mt-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white"
    >
      {unread}
    </span>
  );
}

type Entry =
  | { kind: "comment"; at: string; comment: SectionComment }
  | { kind: "ask"; at: string; id: string; body: string }
  | { kind: "status"; at: string; event: SectionStatusEvent };

const STATUS_DOT: Record<StatusId, string> = {
  todo: "bg-rose-500",
  review: "bg-amber-400",
  done: "bg-emerald-500",
};

function StatusWord({ status }: { status: StatusId }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-[#3d4f63]">
      <span className={`inline-block h-2 w-2 rounded-[2px] ${STATUS_DOT[status]}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

function StatusLine({ event, you }: { event: SectionStatusEvent; you: boolean }) {
  return (
    <div className="flex items-start gap-2 px-0.5">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#c5d0dc]" aria-hidden />
      <p className="min-w-0 flex-1 text-xs leading-5 text-[#55657a]">
        <span className="font-medium text-[#3d4f63]">{you ? "You" : event.actor_name || "Someone"}</span>
        {" moved this from "}
        <StatusWord status={event.from} />
        {" to "}
        <StatusWord status={event.to} />
      </p>
      <time dateTime={event.at} className="shrink-0 pt-0.5 text-caption text-[#8595a8]">
        {commentWhen(event.at)}
      </time>
    </div>
  );
}

/** A run of status lines. The latest stays visible; the earlier ones fold away. */
function StatusRun({ events, viewerId }: { events: SectionStatusEvent[]; viewerId: string | null }) {
  const [open, setOpen] = useState(false);
  const latest = events[events.length - 1];
  const earlier = events.slice(0, -1);
  const you = (event: SectionStatusEvent) => Boolean(viewerId) && event.actor_id === viewerId;
  if (!latest) return null;
  return (
    <li className="space-y-1.5">
      {earlier.length && open
        ? earlier.map((event) => <StatusLine key={event.id} event={event} you={you(event)} />)
        : null}
      {earlier.length ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 px-0.5 text-xs font-medium text-[#8595a8] hover:text-[#3d4f63]"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
          {open ? "Show less" : earlier.length === 1 ? "Show more" : `Show more (${earlier.length})`}
        </button>
      ) : null}
      <StatusLine event={latest} you={you(latest)} />
    </li>
  );
}

function feedRows(entries: Entry[]): Array<{ kind: "entry"; entry: Entry } | { kind: "statuses"; events: SectionStatusEvent[] }> {
  const rows: Array<{ kind: "entry"; entry: Entry } | { kind: "statuses"; events: SectionStatusEvent[] }> = [];
  let run: SectionStatusEvent[] = [];
  const flush = () => {
    if (!run.length) return;
    rows.push({ kind: "statuses", events: run });
    run = [];
  };
  for (const entry of entries) {
    if (entry.kind === "status") {
      run.push(entry.event);
      continue;
    }
    flush();
    rows.push({ kind: "entry", entry });
  }
  flush();
  return rows;
}

function PersonMark({ person, size = "sm" }: { person: Pick<CommentPerson, "name" | "avatar_url" | "side">; size?: "sm" | "xs" }) {
  const box = size === "xs" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]";
  if (person.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={person.avatar_url} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full font-semibold ${
        person.side === "bca" ? "bg-[#0c5290] text-white" : "bg-[#eaf3fb] text-[#0c5290]"
      }`}
    >
      {initials(person.name)}
    </span>
  );
}

type MenuView = "actions" | "assign" | "delete";

/** Edit, assign, and delete. The button stays visible. The menu floats so the thread can scroll under it. */
function CommentMenu({
  comment,
  open,
  onOpenChange,
  onEdit,
}: {
  comment: SectionComment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const comments = useSectionComments();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MenuView>("actions");
  const [place, setPlace] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caps = commentCapabilities(comment, comments?.viewerId ?? null);
  const people = comments?.people ?? [];

  useEffect(() => {
    if (open) return;
    setView("actions");
    setError(null);
    setBusy(false);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const up = rect.bottom + 240 > window.innerHeight - 12 && rect.top > 180;
    setPlace({ top: up ? rect.top - 6 : rect.bottom + 6, left: rect.right, up });
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    function close() {
      onOpenChange(false);
    }
    const scroller = buttonRef.current?.closest(".bp-scroll");
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    scroller?.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      scroller?.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [onOpenChange, open]);

  if (!caps.edit && !caps.delete && !caps.assign) return null;

  async function pickAssignee(assigneeId: string | null) {
    if (!comments || busy) return;
    setBusy(true);
    setError(null);
    const failed = await comments.assign(comment.id, assigneeId);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    onOpenChange(false);
  }

  async function confirmDelete() {
    if (!comments || busy) return;
    setBusy(true);
    setError(null);
    const failed = await comments.remove(comment.id);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    onOpenChange(false);
  }

  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-[#0b1b2e] hover:bg-[#f2f7fc] disabled:opacity-50";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Comment actions"
        onClick={() => onOpenChange(!open)}
        className={`-mr-1 -mt-0.5 shrink-0 rounded-md p-1 transition-colors hover:bg-[#f2f7fc] hover:text-[#0b1b2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cc9ec] ${
          open ? "bg-[#f2f7fc] text-[#0b1b2e]" : "text-[#8595a8] group-hover/card:text-[#55657a]"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && place
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: place.top, left: place.left, transform: place.up ? "translate(-100%, -100%)" : "translateX(-100%)" }}
              className="fixed z-[70] w-52 rounded-xl border border-[#e3e8ef] bg-white p-1 shadow-[0_18px_40px_-18px_rgba(5,30,54,0.45)]"
            >
              {view === "actions" ? (
                <>
                  {caps.edit ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={item}
                      onClick={() => {
                        onOpenChange(false);
                        onEdit();
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#55657a]" aria-hidden />
                      Edit
                    </button>
                  ) : null}
                  {caps.assign ? (
                    <button type="button" role="menuitem" className={item} onClick={() => setView("assign")}>
                      <UserRound className="h-3.5 w-3.5 text-[#55657a]" aria-hidden />
                      Assign
                    </button>
                  ) : null}
                  {caps.delete ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={`${item} text-[#9b2c2c] hover:bg-[#fdeeee] ${caps.edit || caps.assign ? "mt-1 border-t border-[#eef2f6] pt-2" : ""}`}
                      onClick={() => setView("delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  ) : null}
                </>
              ) : null}
              {view === "assign" ? (
                <div className="max-h-64 overflow-y-auto">
                  <p className="px-2.5 pb-1 pt-1.5 text-xs text-[#55657a]">Assign to</p>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={!comment.assignee_id}
                    disabled={busy}
                    className={item}
                    onClick={() => void pickAssignee(null)}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f2f7fc] text-[#8595a8]">
                      <UserRound className="h-3 w-3" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">No one</span>
                    {!comment.assignee_id ? <Check className="h-3.5 w-3.5 text-[#0c5290]" aria-hidden /> : null}
                  </button>
                  {people.map((person) => {
                    const selected = person.id === comment.assignee_id;
                    const label = person.id === comments?.viewerId ? "You" : person.name;
                    return (
                      <button
                        key={person.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        disabled={busy}
                        className={item}
                        onClick={() => void pickAssignee(person.id)}
                      >
                        <PersonMark person={person} />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <span className="text-caption text-[#8595a8]">{person.side === "bca" ? "BCA" : "Coach"}</span>
                        {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-[#0c5290]" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {view === "delete" ? (
                <div className="px-2.5 py-2">
                  <p className="text-sm text-[#0b1b2e]">Delete this comment?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void confirmDelete()}
                      className={buttonClass("delete", "small")}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                      Delete
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setView("actions")}
                      className={buttonClass("quiet", "small")}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {error ? <p className="px-2.5 pb-1.5 text-xs text-[#9b2c2c]">{error}</p> : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function CommentCard({
  comment,
  menuOpen,
  onMenu,
}: {
  comment: SectionComment;
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
}) {
  const comments = useSectionComments();
  const viewerId = comments?.viewerId ?? null;
  const mine = Boolean(viewerId && comment.author_id === viewerId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edited = Boolean(comment.updated_at && comment.updated_at !== comment.created_at);

  useEffect(() => {
    if (!editing) setDraft(comment.body);
  }, [comment.body, editing]);

  async function save() {
    const body = draft.trim();
    if (!body || saving || !comments) return;
    setSaving(true);
    setError(null);
    const failed = await comments.edit(comment.id, body);
    setSaving(false);
    if (failed) {
      setError(failed);
      return;
    }
    setEditing(false);
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save();
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      setEditing(false);
      setDraft(comment.body);
      setError(null);
    }
  }

  return (
    <li>
      <article
        className={`group/card rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(5,30,54,0.05)] ${mine ? "border-[#cfe3f5]" : "border-[#e3e8ef]"}`}
      >
        <div className="flex items-start gap-2.5">
          <CommentAvatar comment={comment} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-[#0b1b2e]">{mine ? "You" : comment.author_name}</span>
                <SideTag comment={comment} />
                <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString("en-GB")} className="text-xs text-[#8595a8]">
                  {commentWhen(comment.created_at)}
                </time>
                {edited ? <span className="text-xs text-[#8595a8]">Edited</span> : null}
              </div>
              {editing ? null : (
                <CommentMenu comment={comment} open={menuOpen} onOpenChange={onMenu} onEdit={() => setEditing(true)} />
              )}
            </div>
            {editing ? (
              <div className="mt-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
                  onKeyDown={onKey}
                  rows={3}
                  autoFocus
                  className="bp-input block w-full resize-none rounded-xl border border-[#e3e9f0] bg-[#f4f7fa] px-3 py-2 text-sm leading-relaxed text-[#1e2f44] outline-none focus:border-[#bfdcf2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,143,212,0.12)]"
                />
                {error ? <p className="mt-1.5 text-xs text-[#9b2c2c]">{error}</p> : null}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || !draft.trim()}
                    className={buttonClass("main", "small")}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setDraft(comment.body);
                      setError(null);
                    }}
                    className={buttonClass("quiet", "small")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1e2f44]">{comment.body}</p>
            )}
            {comment.assignee_id && !editing ? (
              <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f2f7fc] py-0.5 pl-0.5 pr-2 text-xs font-medium text-[#0c5290]">
                <PersonMark
                  size="xs"
                  person={{
                    name: comment.assignee_name || "Assigned",
                    avatar_url: comment.assignee_avatar_url,
                    side: comments?.people.find((person) => person.id === comment.assignee_id)?.side ?? "bca",
                  }}
                />
                <span className="truncate">Assigned to {comment.assignee_id === viewerId ? "you" : comment.assignee_name}</span>
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}

/**
 * The right-hand panel for one section's conversation: comments above, the box
 * pinned at the bottom. The box starts one line high and grows as you write.
 */
export function CommentsPanel() {
  const comments = useSectionComments();
  const { payload, coachName, transcribe } = usePractice();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const { ref: panelRef, half } = useHalfHeight<HTMLDivElement>();
  const feedRef = useRef<HTMLDivElement>(null);
  // The box grows with the comment, up to half the panel, then scrolls.
  const boxRef = useAutoGrow(draft, half);
  const voice = useVoiceInput(transcribe, (said) => {
    setDraft((prev) => (prev ? `${prev} ${said}` : said).slice(0, COMMENT_MAX_LENGTH));
    boxRef.current?.focus();
  });
  const { recording, transcribing } = voice;

  const key = comments?.openKey ?? null;
  const ref = key ? sectionByKey(key) : null;
  const side = comments?.side ?? null;
  const count = key ? comments?.threads[key]?.total ?? 0 : 0;
  const statusCount = key ? (payload?.review.status_log?.value ?? []).filter((event) => event.section === key).length : 0;

  useEffect(() => {
    boxRef.current?.focus();
  }, [boxRef]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, side, statusCount]);

  if (!comments || !key || !ref) return null;

  const entries: Entry[] = [
    ...comments.comments
      .filter((c) => c.section_key === key)
      .map((comment): Entry => ({ kind: "comment", at: comment.created_at, comment })),
    // Change requests from "Ask for a change" sit in the same conversation.
    ...(payload?.review.notes?.value ?? [])
      .filter((note) => note.section === key)
      .map((note): Entry => ({ kind: "ask", at: note.at, id: note.id, body: note.body })),
    ...(payload?.review.status_log?.value ?? [])
      .filter((event) => event.section === key)
      .map((event): Entry => ({ kind: "status", at: event.at, event })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const rows = feedRows(entries);

  const other = side === "bca" ? coachName || "the coach" : "BCA";
  // The whole panel is the conversation, so writing in the box is the reply.
  const replying = entries.some((e) => e.kind === "ask" || (e.kind === "comment" && e.comment.author_side !== side));

  async function send() {
    const body = draft.trim();
    if (!body || sending || !comments || !key) return;
    setSending(true);
    setError(null);
    const failed = await comments.post(key, body);
    setSending(false);
    if (failed) {
      setError(failed);
      return;
    }
    setDraft("");
    boxRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
    if (e.key === "Escape" && !draft.trim()) comments?.close();
  }

  return (
    <div ref={panelRef} className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex items-start gap-2 border-b border-[var(--bp-rule)] px-3 py-3">
        <button
          type="button"
          onClick={comments.openList}
          aria-label="All comments"
          title="All comments"
          className="mt-0.5 rounded-md p-1 text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="text-kicker font-semibold uppercase text-[var(--bp-faint)]">{ref.page.title}</p>
          <h2 className="mt-0.5 text-ui font-semibold leading-snug text-[var(--bp-ink)]">{ref.section.title}</h2>
        </div>
      </header>

      <div ref={feedRef} className="bp-scroll min-h-0 flex-1 overflow-y-auto bg-[#f5f8fb] px-4 py-4">
        {!side ? (
          <p className="flex items-center gap-2 text-sm text-[var(--bp-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading comments
          </p>
        ) : entries.length ? (
          <ol className="space-y-3">
            {rows.map((row) => {
              if (row.kind === "statuses") {
                return <StatusRun key={row.events[0]?.id} events={row.events} viewerId={comments.viewerId} />;
              }
              const entry = row.entry;
              if (entry.kind === "comment") {
                return (
                  <CommentCard
                    key={entry.comment.id}
                    comment={entry.comment}
                    menuOpen={menuId === entry.comment.id}
                    onMenu={(open) => setMenuId(open ? entry.comment.id : null)}
                  />
                );
              }
              if (entry.kind === "ask") {
                return (
                  <li key={entry.id}>
                    <article className="rounded-xl border border-[#f3dfb8] bg-[#fff8ec] p-3.5">
                      <p className="text-xs font-medium text-[#8a5300]">Asked for a change · {commentWhen(entry.at)}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#6b4300]">{entry.body}</p>
                    </article>
                  </li>
                );
              }
              return null;
            })}
          </ol>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1a8fd4] shadow-[0_1px_2px_rgba(5,30,54,0.08)]">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--bp-ink)]">No comments yet</p>
            <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
              Ask a question or leave a note about this section. {other} sees it here.
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--bp-rule)] px-4 py-3.5">
        {error || voice.failed ? <p className="mb-2 text-sm text-[#9b2c2c]">{error || voice.failed}</p> : null}
        <div className="rounded-2xl border border-[var(--bp-rule)] bg-white focus-within:border-[var(--bp-sky)] focus-within:ring-2 focus-within:ring-[#cfe6f8]">
          <textarea
            ref={boxRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
            onKeyDown={onKey}
            rows={1}
            disabled={!side}
            placeholder={transcribing ? "Turning your voice into text…" : replying ? `Reply to ${other}` : `Write to ${other}`}
            className="bp-input block w-full resize-none bg-transparent px-4 pb-1 pt-3 text-ui leading-6 text-[var(--bp-ink)] outline-none placeholder:text-[var(--bp-faint)]"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
            <button
              type="button"
              onClick={() => void voice.toggle()}
              aria-pressed={recording}
              disabled={transcribing}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                recording ? "bg-[#fdeeee] text-[#9b1c1c]" : "text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
              }`}
            >
              {transcribing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : recording ? (
                <Square className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Mic className="h-3.5 w-3.5" aria-hidden />
              )}
              {recording ? "Stop" : "Speak"}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-caption text-[var(--bp-faint)]">⌘ Enter</span>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || sending || !side}
                aria-label="Send"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bp-navy)] text-white transition-colors hover:bg-[var(--bp-blue)] disabled:opacity-35"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

type ListRow = { key: string; at: string; who: string; body: string; unread: number };

/** Conversations on the page you are reading. Unread first, then newest. Choosing one opens it beside its section. */
export function CommentsList({ page }: { page: BlueprintLink | null }) {
  const comments = useSectionComments();
  const { payload, href, coachName } = usePractice();
  const router = useRouter();
  if (!comments) return null;
  const side = comments.side;
  const other = side === "bca" ? coachName || "the coach" : "BCA";

  const latest = new Map<string, ListRow>();
  const consider = (row: Omit<ListRow, "unread">) => {
    const have = latest.get(row.key);
    if (!have || Date.parse(row.at) >= Date.parse(have.at)) latest.set(row.key, { ...row, unread: 0 });
  };
  for (const c of comments.comments) {
    consider({ key: c.section_key, at: c.created_at, who: c.author_side === side ? "You" : c.author_name, body: c.body });
  }
  for (const note of payload?.review.notes?.value ?? []) {
    if (note.section) consider({ key: note.section, at: note.at, who: "Change asked", body: note.body });
  }
  const rows = [...latest.values()]
    .filter((row) => sectionByKey(row.key)?.page.slug === page?.slug)
    .map((row) => ({ ...row, unread: comments.threads[row.key]?.unread ?? 0 }))
    .sort((a, b) => b.unread - a.unread || Date.parse(b.at) - Date.parse(a.at));

  function go(key: string) {
    const ref = sectionByKey(key);
    if (!ref || !comments) return;
    const onPage = document.getElementById(`s-${key.replace(":", "-")}`);
    comments.open(key);
    if (!onPage) router.push(href(ref.page.href));
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <p className="border-b border-[var(--bp-rule)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bp-faint)]">
        {page?.title ?? "This page"}
      </p>
      <div className="bp-scroll min-h-0 flex-1 overflow-y-auto bg-[#f5f8fb] p-3">
        {!side ? (
          <p className="flex items-center gap-2 px-2 py-1 text-sm text-[var(--bp-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading comments
          </p>
        ) : rows.length ? (
          <ul className="space-y-2">
            {rows.map((row) => {
              const ref = sectionByKey(row.key)!;
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => go(row.key)}
                    className={`w-full rounded-xl border bg-white p-3 text-left shadow-[0_1px_2px_rgba(5,30,54,0.05)] transition-colors hover:border-[#9cc9ec] ${
                      row.unread ? "border-[#f3c1c7]" : "border-[#e3e8ef]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-[#0b1b2e]">{ref.section.title}</span>
                      <time dateTime={row.at} className="shrink-0 text-xs text-[#8595a8]">
                        {commentWhen(row.at)}
                      </time>
                    </div>
                    <div className="mt-1.5 flex items-start gap-2">
                      <p className={`line-clamp-2 min-w-0 flex-1 text-ui leading-5 ${row.unread ? "text-[#0b1b2e]" : "text-[#55657a]"}`}>
                        <span className="font-medium">{row.who}: </span>
                        {row.body}
                      </p>
                      {row.unread ? (
                        <span className="mt-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                          {row.unread}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1a8fd4] shadow-[0_1px_2px_rgba(5,30,54,0.08)]">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--bp-ink)]">No conversations on this page</p>
            <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
              Click the speech bubble on a section to ask {other} about it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
