"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, Loader2, MessageSquare, MoreHorizontal, Pencil, Trash2, UserRound } from "lucide-react";

import { AvaHalo } from "@/components/ava/AvaHalo";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { blueprintPage, sectionByKey, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { chatKeyPage, commentPage } from "@/lib/practiceKnowledge/pageChat";
import type { PageMove } from "@/lib/practiceKnowledge/pageMoves";
import { PAGE_STATUS_COPY, type PageStatusId } from "@/lib/practiceKnowledge/pageStatus";
import { commentCapabilities, COMMENT_MAX_LENGTH, type CommentPerson, type SectionComment } from "@/lib/practiceKnowledge/sectionCommentTypes";

import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";

import { useHalfHeight } from "../composer";
import { ChatComposer } from "./ChatComposer";
import { FileDropZone } from "@/components/messaging/FileDropZone";
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
    return <AvaHalo size={size === "sm" ? 24 : 28} className="shrink-0" />;
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

/** First names only in chats (5 Nov): "Zander", not "Zander Woodford-Smith". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Only Ava is tagged (AI), so coaches know when it isn't a person. BCA people are just their names (5 Nov). */
function SideTag({ comment }: { comment: SectionComment }) {
  if (comment.author_side !== "ava") return null;
  return (
    <span className="rounded bg-[#e3eef8] px-1 text-caption font-semibold tracking-[0.04em] text-[#0c5290]">AI</span>
  );
}

/** One comment as a compact line. Plain colours, so it also works on the admin overview. */
export function CommentItem({ comment, mine, compact = false }: { comment: SectionComment; mine: boolean; compact?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <CommentAvatar comment={comment} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-ui leading-5">
          <span className="font-medium text-[#0b1b2e]">{mine ? "You" : firstName(comment.author_name)}</span>
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
    ? `${title}: ${unread} new message${unread === 1 ? "" : "s"}`
    : total
      ? `${title}: ${total} message${total === 1 ? "" : "s"}`
      : `Chat about ${title}`;

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

/**
 * Beside "Ask Ava" at the top of a page. On a page: "Chat", the page's one
 * chat. On the full document: "Chats", the list of every conversation (5 Nov: one word, Chat, everywhere).
 */
export function CommentsButton({ pageSlug = null }: { pageSlug?: string | null }) {
  const comments = useSectionComments();
  if (!comments?.side) return null;
  const unread = Object.entries(comments.threads).reduce(
    (n, [key, t]) => n + (!pageSlug || commentPage(key) === pageSlug ? t.unread : 0),
    0
  );
  return (
    <button
      type="button"
      onClick={() => (pageSlug ? comments.openChat(pageSlug) : comments.openList())}
      className={buttonClass("second", "small", "bp-no-print relative shrink-0")}
    >
      <MessageSquare className="h-4 w-4" aria-hidden />
      {pageSlug ? "Chat" : "Chats"}
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
    if (thread.unread && commentPage(key) === pageSlug) unread += thread.unread;
  }
  if (!unread) return null;
  return (
    <span
      title={`${unread} new message${unread === 1 ? "" : "s"}`}
      className="mt-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white"
    >
      {unread}
    </span>
  );
}

/**
 * Messages, plus one quiet line when the whole page moves status (5 Nov).
 * Section status moves no longer show here, but are still logged.
 */
type Entry =
  | { kind: "comment"; at: string; comment: SectionComment }
  | { kind: "ask"; at: string; id: string; body: string }
  | { kind: "move"; at: string; id: string; to: PageStatusId };

const PAGE_DOT: Record<PageStatusId, string> = {
  needs_you: "bg-rose-500",
  bca: "bg-slate-400",
  in_progress: "bg-sky-500",
  review: "bg-amber-400",
  done: "bg-emerald-500",
};

/** Moves with nothing said in between become one line; a page that ends where it started shows none. */
function foldMoves(entries: Entry[], moves: PageMove[]): Entry[] {
  const all: Array<Entry | { kind: "raw"; at: string; move: PageMove }> = [
    ...entries,
    ...moves.map((move) => ({ kind: "raw" as const, at: move.at, move })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const out: Entry[] = [];
  let run: PageMove[] = [];
  const flush = () => {
    const first = run[0];
    const last = run[run.length - 1];
    if (first && last && first.from !== last.to) out.push({ kind: "move", at: last.at, id: last.id, to: last.to });
    run = [];
  };
  for (const item of all) {
    if (item.kind === "raw") {
      run.push(item.move);
      continue;
    }
    flush();
    out.push(item);
  }
  flush();
  return out;
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
  // Ava's messages carry the admin who approved them, but they are hers.
  const mine = Boolean(viewerId && comment.author_id === viewerId && comment.author_side !== "ava");
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
        className={`bp-chat-msg group/card rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(5,30,54,0.05)] ${mine ? "border-[#cfe3f5]" : "border-[#e3e8ef]"}`}
      >
        <div className="flex items-start gap-2.5">
          <CommentAvatar comment={comment} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                {/* Your own name, like Slack and ClickUp (5 Nov): "You" read oddly as a message author. */}
                <span className="bp-chat-name text-sm font-medium text-[#0b1b2e]">{firstName(comment.author_name) || "You"}</span>
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
                  className={fieldClass("textarea", "normal", "bp-input resize-none")}
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
              <>
                {/* "Sent a voice note" and the like only stand in for an empty box: the file says it. */}
                {comment.media.length && /^Sent (a voice note|a video|an image|images|a document|documents)$/.test(comment.body) ? null : (
                  <p className="bp-chat-body mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1e2f44]">{comment.body}</p>
                )}
                {comment.media.length ? (
                  <div className="mt-1.5 max-w-[20rem]">
                    <CommunityPostMediaGallery items={comment.media} variant="compact" />
                  </div>
                ) : null}
              </>
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
/** `framed`: the Blueprint's right-hand column already has a header, so a page chat needs no second one. */
export function CommentsPanel({ framed = false }: { framed?: boolean } = {}) {
  const comments = useSectionComments();
  const { payload, coachName } = usePractice();
  const [menuId, setMenuId] = useState<string | null>(null);
  const { ref: panelRef, half } = useHalfHeight<HTMLDivElement>();
  const feedRef = useRef<HTMLDivElement>(null);

  const key = comments?.openKey ?? null;
  const ref = key ? sectionByKey(key) : null;
  // A page's chat holds every conversation on the page, old section ones too.
  const chatSlug = key ? chatKeyPage(key) : null;
  const chatPage = chatSlug ? blueprintPage(chatSlug) : null;
  const inThread = (k: string | null | undefined) => Boolean(k) && (chatSlug ? commentPage(k!) === chatSlug : k === key);
  const side = comments?.side ?? null;
  const count = comments ? comments.comments.filter((c) => inThread(c.section_key)).length : 0;

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, side]);

  if (!comments || !key || (!ref && !chatPage)) return null;

  const entries: Entry[] = [
    ...comments.comments
      .filter((c) => inThread(c.section_key))
      .map((comment): Entry => ({ kind: "comment", at: comment.created_at, comment })),
    // Change requests from "Ask for a change" sit in the same conversation.
    ...(payload?.review.notes?.value ?? [])
      .filter((note) => inThread(note.section))
      .map((note): Entry => ({ kind: "ask", at: note.at, id: note.id, body: note.body })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const feed = chatSlug ? foldMoves(entries, comments.pageMoves.filter((move) => move.page_slug === chatSlug)) : entries;

  const other = side === "bca" ? coachName || "the coach" : "BCA";
  // The whole panel is the conversation, so writing in the box is the reply.
  const replying = entries.some((e) => e.kind === "ask" || (e.kind === "comment" && e.comment.author_side !== side));

  return (
    <FileDropZone ref={panelRef} className="bp-chat-panel flex h-full min-h-0 flex-col bg-white">
      {framed && chatPage ? null : (
      <header className="bp-chat-head flex items-start gap-2 border-b border-[var(--bp-rule)] px-3 py-3">
        {chatPage ? null : (
          <button
            type="button"
            onClick={comments.openList}
            aria-label="All chats"
            title="All chats"
            className="mt-0.5 rounded-md p-1 text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
        <div className={`min-w-0 ${chatPage ? "px-1" : ""}`}>
          <p className="bp-chat-kicker text-kicker font-semibold uppercase text-[var(--bp-faint)]">{(chatPage ?? ref!.page).title}</p>
          <h2 className="mt-0.5 text-ui font-semibold leading-snug text-[var(--bp-ink)]">
            {chatPage ? `Chat with ${other}` : ref!.section.title}
          </h2>
        </div>
      </header>
      )}

      <div ref={feedRef} className="bp-scroll bp-chat-feed min-h-0 flex-1 overflow-y-auto bg-[#f5f8fb] px-4 py-4">
        {!side ? (
          <p className="flex items-center gap-2 text-sm text-[var(--bp-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the chat
          </p>
        ) : feed.length ? (
          <ol className="bp-chat-list space-y-3">
            {feed.map((entry) => {
              if (entry.kind === "move") {
                return (
                  <li key={entry.id} className="flex items-center gap-2 px-2 py-0.5 text-xs text-[#55657a]">
                    <span className={`h-2 w-2 shrink-0 rounded-[2px] ${PAGE_DOT[entry.to]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      This page moved to <span className="font-medium text-[#3d4f63]">{PAGE_STATUS_COPY[entry.to].label}</span>
                    </span>
                    <time dateTime={entry.at} className="shrink-0 text-caption text-[#8595a8]">
                      {commentWhen(entry.at)}
                    </time>
                  </li>
                );
              }
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
            <p className="mt-3 text-sm font-semibold text-[var(--bp-ink)]">No messages yet</p>
            <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
              {chatPage?.slug === "command"
                ? `Ask ${other} anything that isn't about one page. ${other} sees it here.`
                : chatPage
                ? `Ask ${other} anything about this page. ${other} sees it here.`
                : `Ask a question or leave a note about this section. ${other} sees it here.`}
            </p>
          </div>
        )}
      </div>

      <ChatComposer key={key} chatKey={key} other={other} replying={replying} maxHeight={half} onEscape={() => comments.close()} />
    </FileDropZone>
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
    .filter((row) => Boolean(page) && commentPage(row.key) === page?.slug)
    .map((row) => ({ ...row, unread: comments.threads[row.key]?.unread ?? 0 }))
    .sort((a, b) => b.unread - a.unread || Date.parse(b.at) - Date.parse(a.at));

  function go(key: string) {
    const ref = sectionByKey(key);
    const chatSlug = chatKeyPage(key);
    if (chatSlug && comments) {
      const chatPage = blueprintPage(chatSlug);
      comments.openChat(chatSlug);
      if (chatPage && page?.slug !== chatSlug) router.push(href(chatPage.href));
      return;
    }
    if (!ref || !comments) return;
    const onPage = document.getElementById(`s-${key.replace(":", "-")}`);
    comments.open(key);
    if (!onPage) router.push(href(ref.page.href));
  }

  return (
    <div className="bp-chat-panel flex h-full min-h-0 flex-col bg-white">
      <p className="border-b border-[var(--bp-rule)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bp-faint)]">
        {page?.title ?? "This page"}
      </p>
      <div className="bp-scroll bp-list-feed min-h-0 flex-1 overflow-y-auto bg-[#f5f8fb] p-3">
        {!side ? (
          <p className="flex items-center gap-2 px-2 py-1 text-sm text-[var(--bp-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the chat
          </p>
        ) : rows.length ? (
          <ul className="space-y-2">
            {rows.map((row) => {
              const title = sectionByKey(row.key)?.section.title ?? "Chat";
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
                      <span className="min-w-0 truncate text-sm font-medium text-[#0b1b2e]">{title}</span>
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
