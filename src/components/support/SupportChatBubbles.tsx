"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import { SupportMessageBody } from "@/components/support/SupportMessageBody";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { formatDayLabel, formatShortTime } from "@/lib/formatShortDate";
import type { SupportInternalNote } from "@/lib/support/internalNotes";
import { parseSupportReplyMedia } from "@/lib/support/supportTicketMedia";
import {
  authorDisplayName,
  isSupportStaffAuthor,
  type SupportReply,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";

function calendarDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export type SupportThreadItem =
  | { kind: "reply"; created_at: string; reply: SupportReply }
  | { kind: "note"; created_at: string; note: SupportInternalNote };

export function mergeSupportThreadItems(
  replies: SupportReply[],
  notes: SupportInternalNote[] = []
): SupportThreadItem[] {
  const items: SupportThreadItem[] = [
    ...replies.map(
      (reply): SupportThreadItem => ({
        kind: "reply",
        created_at: reply.created_at,
        reply,
      })
    ),
    ...notes.map(
      (note): SupportThreadItem => ({
        kind: "note",
        created_at: note.created_at,
        note,
      })
    ),
  ];
  items.sort((a, b) => {
    const at = new Date(a.created_at).getTime();
    const bt = new Date(b.created_at).getTime();
    if (at !== bt) return at - bt;
    return a.kind === b.kind ? 0 : a.kind === "note" ? 1 : -1;
  });
  return items;
}

function groupItemsByDay(items: SupportThreadItem[]) {
  const groups: { key: string; label: string; items: SupportThreadItem[] }[] =
    [];
  for (const item of items) {
    const key = calendarDayKey(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({
        key,
        label: formatDayLabel(item.created_at),
        items: [item],
      });
    }
  }
  return groups;
}

function previewText(text: string, max = 72): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function SupportInternalNoteCard({ note }: { note: SupportInternalNote }) {
  const [open, setOpen] = useState(true);
  const authorName = authorDisplayName(note.author) || "Admin";

  return (
    <div className="flex justify-center px-1">
      <div className="w-full max-w-[min(92%,28rem)] overflow-hidden rounded-xl border border-dashed border-amber-200 bg-amber-50/80 text-sm text-amber-950">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-amber-50"
        >
          <Eye className="h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-amber-800">
            Internal note
            <span className="font-normal text-amber-700/70">
              {" · "}
              {authorName}
              {!open ? ` · ${previewText(note.body)}` : null}
            </span>
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-amber-600/70">
            {formatShortTime(note.created_at)}
          </span>
        </button>
        {open ? (
          <div className="border-t border-amber-200/60 px-3.5 py-2.5">
            <SupportMessageBody
              body={note.body}
              className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-amber-950"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SupportChatAvatar({
  name,
  avatarUrl,
  tone = "slate",
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  tone?: "slate" | "sky";
  size?: "xs" | "md";
}) {
  const initials = profileInitialsFromName(name);
  const box = size === "xs" ? "h-5 w-5 text-[9px]" : "h-9 w-9 text-[11px]";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${box} shrink-0 rounded-full object-cover ring-1 ring-slate-200/80`}
      />
    );
  }
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full font-semibold ring-1 ${
        tone === "sky"
          ? "bg-sky-100 text-sky-800 ring-sky-200/80"
          : "bg-slate-200 text-slate-700 ring-slate-200/80"
      }`}
    >
      {initials}
    </span>
  );
}

function menuTriggerClass(outbound: boolean, open: boolean): string {
  if (outbound) {
    return [
      "-mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded transition",
      "text-sky-800/50 hover:bg-sky-200/60 hover:text-sky-950",
      open ? "bg-sky-200/60 text-sky-950" : "",
    ].join(" ");
  }
  return [
    "-mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded transition",
    "text-slate-400/80 hover:bg-slate-100 hover:text-slate-600",
    open ? "bg-slate-100 text-slate-600" : "",
  ].join(" ");
}

function SupportReplyActionsMenu({
  replyId,
  outbound,
  busy,
  onEdit,
  onDelete,
}: {
  replyId: string;
  outbound: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = `support-reply-actions-${replyId}`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function stop(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={menuTriggerClass(outbound, open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label="Message actions"
        disabled={busy}
        onClick={(event) => {
          stop(event);
          setOpen((v) => !v);
        }}
      >
        <MoreVertical className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-30 mt-0.5 min-w-[8.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-0.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5 ${
            outbound ? "right-0" : "left-0"
          }`}
          onClick={stop}
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3 shrink-0 text-rose-400" aria-hidden />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

type BubbleProps = {
  reply: SupportReply;
  /** True when this bubble is on the right (outgoing for this viewer). */
  outbound: boolean;
  /** Prefer this label when author is missing. */
  fallbackName?: string;
  /** Admin-only: show ⋮ edit/delete next to the timestamp. */
  canManage?: boolean;
  onUpdateBody?: (replyId: string, body: string) => Promise<void>;
  onDelete?: (replyId: string) => Promise<void>;
};

export function SupportChatBubble({
  reply,
  outbound,
  fallbackName = "Support",
  canManage = false,
  onUpdateBody,
  onDelete,
}: BubbleProps) {
  const name = authorDisplayName(reply.author) || fallbackName;
  const avatarUrl = reply.author?.avatar_url ?? null;
  const media = parseSupportReplyMedia(reply.media);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(reply.body);
  }, [editing, reply.body]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const metaTone = outbound ? "text-sky-800/55" : "text-slate-400";
  const canSave = draft.trim().length > 0 || media.length > 0;

  async function saveEdit(event?: FormEvent) {
    event?.preventDefault();
    if (!onUpdateBody || !canSave || busy) return;
    const next = draft.trim() ? draft : "";
    if (next === reply.body) {
      setEditing(false);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onUpdateBody(reply.id, next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || busy) return;
    const confirmed = window.confirm(
      "Delete this message? This cannot be undone."
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(reply.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex items-end gap-2 ${
        outbound ? "justify-end" : "justify-start"
      }`}
    >
      {!outbound ? (
        <SupportChatAvatar name={name} avatarUrl={avatarUrl} />
      ) : null}
      <div
        className={`min-w-0 max-w-[min(85%,26rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ring-1 ${
          outbound
            ? "rounded-br-md bg-sky-100/90 text-sky-950 ring-sky-200/70"
            : "rounded-bl-md bg-white text-slate-900 ring-slate-200/80"
        }`}
      >
        {editing ? (
          <form onSubmit={(e) => void saveEdit(e)} className="space-y-2">
            <textarea
              ref={textareaRef}
              rows={3}
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                  setError(null);
                  setDraft(reply.body);
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void saveEdit();
                }
              }}
              className="w-full resize-y rounded-lg border border-sky-300 bg-white px-2.5 py-2 text-sm text-sky-950 placeholder:text-sky-800/40 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-60"
              placeholder="Message…"
            />
            {media.length > 0 ? (
              <div className="opacity-90">
                <CommunityPostMediaGallery items={media} variant="compact" />
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setDraft(reply.body);
                }}
                className={
                  outbound
                    ? "rounded-md px-2 py-1 text-[11px] font-medium text-sky-900/75 hover:bg-sky-200/50 disabled:opacity-50"
                    : "rounded-md px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                }
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !canSave}
                className="rounded-md bg-sky-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {reply.body.trim() ? <SupportMessageBody body={reply.body} /> : null}
            {media.length > 0 ? (
              <div className="mt-2">
                <CommunityPostMediaGallery items={media} variant="compact" />
              </div>
            ) : null}
          </>
        )}
        <div
          className={`mt-1.5 flex items-center gap-1 ${
            outbound ? "justify-end" : "justify-start"
          } ${metaTone}`}
        >
          <span className="text-[10px] tabular-nums">
            {formatShortTime(reply.created_at)}
          </span>
          {reply.edited_at ? (
            <span className="text-[10px] opacity-80">· edited</span>
          ) : null}
          {canManage && !editing ? (
            <SupportReplyActionsMenu
              replyId={reply.id}
              outbound={outbound}
              busy={busy}
              onEdit={() => {
                setDraft(reply.body);
                setError(null);
                setEditing(true);
              }}
              onDelete={() => void handleDelete()}
            />
          ) : null}
        </div>
        {error ? (
          <p
            className={
              outbound
                ? "mt-1 text-[10px] text-rose-800"
                : "mt-1 text-[10px] text-rose-600"
            }
          >
            {error}
          </p>
        ) : null}
      </div>
      {outbound ? (
        <SupportChatAvatar name={name} avatarUrl={avatarUrl} tone="sky" />
      ) : null}
    </div>
  );
}

type ThreadProps = {
  replies: SupportReply[];
  /** Admin-only internal notes interleaved by time. Never pass from coach UI. */
  notes?: SupportInternalNote[];
  /** Viewer user id — used with perspective to decide left/right. */
  viewerId: string | null;
  /**
   * admin = staff messages on the right, member on the left.
   * member = own messages on the right, staff on the left.
   */
  perspective: "admin" | "member";
  emptyLabel?: string;
  onUpdateReplyBody?: (replyId: string, body: string) => Promise<void>;
  onDeleteReply?: (replyId: string) => Promise<void>;
};

export function SupportChatThread({
  replies,
  notes = [],
  viewerId,
  perspective,
  emptyLabel,
  onUpdateReplyBody,
  onDeleteReply,
}: ThreadProps) {
  const canManage =
    perspective === "admin" &&
    Boolean(onUpdateReplyBody || onDeleteReply);

  const items =
    perspective === "admin"
      ? mergeSupportThreadItems(replies, notes)
      : mergeSupportThreadItems(replies);

  if (items.length === 0) {
    return emptyLabel ? (
      <p className="py-6 text-center text-sm text-slate-500">{emptyLabel}</p>
    ) : null;
  }

  const byDay = groupItemsByDay(items);

  return (
    <div className="space-y-3">
      {byDay.map((group) => (
        <div key={group.key} className="space-y-3">
          <div className="flex justify-center py-1">
            <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
              {group.label}
            </span>
          </div>
          {group.items.map((item) => {
            if (item.kind === "note") {
              return (
                <SupportInternalNoteCard key={item.note.id} note={item.note} />
              );
            }

            const reply = item.reply;
            const staff = isSupportStaffAuthor(reply.author);
            const mine = viewerId != null && reply.created_by === viewerId;
            const outbound =
              perspective === "admin" ? staff || mine : mine && !staff;

            return (
              <SupportChatBubble
                key={reply.id}
                reply={reply}
                outbound={outbound}
                canManage={canManage}
                onUpdateBody={onUpdateReplyBody}
                onDelete={onDeleteReply}
                fallbackName={
                  staff
                    ? "Support"
                    : perspective === "member"
                      ? "You"
                      : "Member"
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function supportAuthorShortName(
  author: SupportTicketAuthor | null | undefined
): string {
  if (!author) return "Support";
  const first = author.first_name?.trim();
  if (first) return first;
  return authorDisplayName(author);
}
