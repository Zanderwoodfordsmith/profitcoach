"use client";

import { SeenTick } from "./SeenTick";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Clock, Eye, Mail, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { AvaHalo } from "@/components/ava/AvaHalo";
import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import { commentWhen, firstName } from "@/components/practice/comments/SectionCommentsUI";
import { SupportMessageBody } from "@/components/support/SupportMessageBody";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { profileInitialsFromName } from "@/lib/communityProfile";
import {
  formatDayLabel,
  formatShortDateTime,
  formatShortTime,
} from "@/lib/formatShortDate";
import type { SupportInternalNote } from "@/lib/support/internalNotes";
import { parseSupportReplyMedia } from "@/lib/support/supportTicketMedia";
import {
  authorDisplayName,
  isSupportStaffAuthor,
  type SupportReply,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";
import { buttonClass } from "@/components/ui/Button";
import { badgeClass } from "@/components/ui/Badge";

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

function SupportInternalNoteCard({
  note,
  canManage = false,
  onUpdateBody,
  onDelete,
}: {
  note: SupportInternalNote;
  canManage?: boolean;
  onUpdateBody?: (noteId: string, body: string) => Promise<void>;
  onDelete?: (noteId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const authorName = authorDisplayName(note.author) || "Admin";

  useEffect(() => {
    if (!editing) setDraft(note.body);
  }, [editing, note.body]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const canSave = draft.trim().length > 0;

  async function saveEdit(event?: FormEvent) {
    event?.preventDefault();
    if (!onUpdateBody || !canSave || busy) return;
    const next = draft.trim();
    if (next === note.body) {
      setEditing(false);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onUpdateBody(note.id, next);
      setEditing(false);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || busy) return;
    const confirmed = window.confirm(
      "Delete this internal note? This cannot be undone."
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(note.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-center px-1">
      <div className="w-full max-w-[min(92%,28rem)] rounded-xl border border-dashed border-amber-200 bg-amber-50/80 text-sm text-amber-950">
        <div className="flex w-full items-center gap-2 px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => {
              if (editing) return;
              setOpen((v) => !v);
            }}
            aria-expanded={open || editing}
            className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-90"
          >
            <Eye
              className="h-3.5 w-3.5 shrink-0 text-amber-600"
              strokeWidth={2}
            />
            <span className="min-w-0 flex-1 truncate text-caption font-medium text-amber-800">
              Internal note
              <span className="font-normal text-amber-700/70">
                {" · "}
                {authorName}
                {!open && !editing ? ` · ${previewText(note.body)}` : null}
              </span>
            </span>
          </button>
          <span className="shrink-0 text-caption tabular-nums text-amber-600/70">
            {formatShortTime(note.created_at)}
          </span>
          {note.edited_at ? (
            <span className="shrink-0 text-caption text-amber-600/70">
              · edited
            </span>
          ) : null}
          {canManage && !editing ? (
            <SupportReplyActionsMenu
              replyId={note.id}
              outbound={false}
              alignRight
              busy={busy}
              onEdit={() => {
                setDraft(note.body);
                setError(null);
                setEditing(true);
                setOpen(true);
              }}
              onDelete={() => void handleDelete()}
            />
          ) : null}
        </div>
        {editing ? (
          <form
            onSubmit={(e) => void saveEdit(e)}
            className="space-y-2 border-t border-amber-200/60 px-3.5 py-2.5"
          >
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
                  setDraft(note.body);
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void saveEdit();
                }
              }}
              className="w-full resize-y rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-sm text-amber-950 placeholder:text-amber-800/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
              placeholder="Internal note…"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setDraft(note.body);
                }}
                className="rounded-md px-2 py-1 text-caption font-medium text-amber-900/75 hover:bg-amber-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !canSave}
                className="rounded-md bg-amber-800 px-2.5 py-1 text-caption font-medium text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
            {error ? (
              <p className="text-caption text-rose-600">{error}</p>
            ) : null}
          </form>
        ) : open ? (
          <div className="border-t border-amber-200/60 px-3.5 py-2.5">
            <SupportMessageBody
              body={note.body}
              className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-amber-950"
            />
            {error ? (
              <p className="mt-1 text-caption text-rose-600">{error}</p>
            ) : null}
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
  size?: "xs" | "sm" | "md";
}) {
  const initials = profileInitialsFromName(name);
  const box = size === "xs" ? "h-5 w-5 text-[9px]" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-caption";
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
  alignRight = outbound,
}: {
  replyId: string;
  outbound: boolean;
  busy: boolean;
  /** Open leftwards from the button (defaults to outbound). */
  alignRight?: boolean;
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
            alignRight ? "right-0" : "left-0"
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

export function SupportViaEmailMark({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      title={label}
    >
      <Mail className="h-3 w-3" strokeWidth={2} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function SupportViaWhatsAppMark({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center text-[#25D366]" title={label}>
      <WhatsAppIcon className="h-3 w-3" />
      <span className="sr-only">{label}</span>
    </span>
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
  /** Admin-only: Mail icon when this message went over email. */
  showEmailChannel?: boolean;
  onUpdateBody?: (replyId: string, body: string) => Promise<void>;
  onDelete?: (replyId: string) => Promise<void>;
  /** "slack": every message left-aligned with avatar and name, like Slack. */
  layout?: SupportThreadLayout;
  /** Slack layout: same person a moment ago, so skip the avatar and name. */
  continued?: boolean;
  /** Cards layout: drawn in the name line after the time (its "Seen" tick). */
  meta?: ReactNode;
};

/**
 * "cards" (Support V2, 5 Nov): the coach's own chat, flat rows of photo, first
 * name and text, so BCA sees what the coach sees. Drawn by the Blueprint's
 * clean chat styles (bp-chat-*), so it needs a `bp-doc bp-clean-side` parent.
 */
export type SupportThreadLayout = "bubbles" | "slack" | "cards";

/** The text of one message in the coach's chat look. */
export const CARDS_BODY_CLASS = "bp-chat-body min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]";

/** One message row in the coach's chat look. */
export const SUPPORT_CHAT_ROW_CLASS = "group bp-chat-msg";

/** Slack's reading size: 15px with tighter lines than the 1.6 used elsewhere. */
export const SLACK_BODY_CLASS =
  "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-normal text-slate-700";

export function SupportChatBubble({
  reply,
  outbound,
  fallbackName = "Support",
  canManage = false,
  showEmailChannel = false,
  onUpdateBody,
  onDelete,
  layout = "bubbles",
  continued = false,
  meta = null,
}: BubbleProps) {
  const name = reply.as_ava ? "Ava" : authorDisplayName(reply.author) || fallbackName;
  const avatarUrl = reply.as_ava ? null : (reply.author?.avatar_url ?? null);
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

  const content = editing ? (
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
                className={buttonClass("quiet", "small")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !canSave}
                className={buttonClass("main", "small")}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {reply.body.trim() ? (
              <SupportMessageBody
                body={reply.body}
                className={layout === "slack" ? SLACK_BODY_CLASS : layout === "cards" ? CARDS_BODY_CLASS : undefined}
              />
            ) : null}
            {media.length > 0 ? (
              <div className="mt-2">
                <CommunityPostMediaGallery items={media} variant="compact" />
              </div>
            ) : null}
          </>
        );

  const emailMark = !showEmailChannel ? null : reply.via_whatsapp ? (
    <SupportViaWhatsAppMark label={outbound ? "Sent on WhatsApp" : "Received on WhatsApp"} />
  ) : reply.via_email ? (
    <SupportViaEmailMark
      className="opacity-80"
      label={outbound ? "Also sent by email" : "Received by email"}
    />
  ) : null;
  const editedMark = reply.edited_at ? (
    <span className="text-caption opacity-80">· edited</span>
  ) : null;
  const actionsMenu =
    canManage && !editing ? (
      <SupportReplyActionsMenu
        replyId={reply.id}
        outbound={layout === "bubbles" ? outbound : false}
        // Cards: the ⋮ sits at the chat's right edge, so its menu opens leftwards (5 Nov: it hid behind the details).
        alignRight={layout === "cards" ? true : undefined}
        busy={busy}
        onEdit={() => {
          setDraft(reply.body);
          setError(null);
          setEditing(true);
        }}
        onDelete={() => void handleDelete()}
      />
    ) : null;

  if (layout === "cards") {
    // First names, as the coach's chat shows them.
    const shownName = reply.as_ava ? "Ava" : firstName(name) || name;
    return (
      <article className={SUPPORT_CHAT_ROW_CLASS}>
        <div className="flex items-start gap-3">
          {reply.as_ava ? (
            <AvaHalo size={36} className="shrink-0" />
          ) : (
            <SupportChatAvatar name={name} avatarUrl={avatarUrl} size="sm" tone={outbound ? "sky" : "slate"} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-x-2">
              <span className="bp-chat-name min-w-0 truncate">{shownName}</span>
              {reply.as_ava ? (
                <span className="rounded bg-[#e3eef8] px-1 text-caption font-semibold tracking-[0.04em] text-[#0c5290]">AI</span>
              ) : null}
              <time
                dateTime={reply.created_at}
                title={new Date(reply.created_at).toLocaleString("en-GB")}
                className="shrink-0 text-xs text-[#8595a8]"
              >
                {commentWhen(reply.created_at)}
              </time>
              <span className="flex shrink-0 items-center gap-1 text-[#8595a8]">
                {emailMark}
                {editedMark}
              </span>
              {reply.origin ? (
                reply.origin.href ? (
                  <a
                    href={reply.origin.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-caption font-medium text-sky-700 hover:underline"
                  >
                    {reply.origin.label}
                  </a>
                ) : (
                  <span className="truncate text-caption font-medium text-slate-500">{reply.origin.label}</span>
                )
              ) : null}
              {/* Right-aligned, like a chat's ticks: the Seen tick, then ⋮ on hover. */}
              {meta || actionsMenu ? (
                <span className="ml-auto flex shrink-0 items-center gap-1 self-center">
                  {meta}
                  {actionsMenu ? (
                    <span className="opacity-0 focus-within:opacity-100 group-hover:opacity-100">{actionsMenu}</span>
                  ) : null}
                </span>
              ) : null}
            </div>
            {content}
            {error ? <p className="mt-1 text-caption text-rose-600">{error}</p> : null}
          </div>
        </div>
      </article>
    );
  }

  if (layout === "slack") {
    return (
      <div
        className={`group flex gap-3 rounded-md px-2 hover:bg-slate-50 ${
          continued ? "py-0.5" : "pb-0.5 pt-4"
        }`}
      >
        <div className="w-9 shrink-0">
          {continued ? (
            <span className="block pt-0.5 text-right text-caption tabular-nums text-slate-400 opacity-0 group-hover:opacity-100">
              {formatShortTime(reply.created_at)}
            </span>
          ) : reply.as_ava ? (
            <AvaHalo size={36} />
          ) : (
            <SupportChatAvatar name={name} avatarUrl={avatarUrl} tone={outbound ? "sky" : "slate"} />
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm text-slate-900">
          {continued ? null : (
            <div className="flex items-baseline gap-2">
              <span className={`${reply.as_ava ? "shrink-0" : "truncate"} text-[15px] font-bold text-slate-900`}>{name}</span>
              <span className="shrink-0 text-caption tabular-nums text-slate-400">
                {formatShortTime(reply.created_at)}
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                {emailMark}
                {editedMark}
              </span>
              {reply.origin ? (
                reply.origin.href ? (
                  <a
                    href={reply.origin.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-caption font-medium text-sky-700 hover:underline"
                  >
                    {reply.origin.label}
                  </a>
                ) : (
                  <span className="truncate text-caption font-medium text-slate-500">{reply.origin.label}</span>
                )
              ) : null}
            </div>
          )}
          {content}
          {continued && (emailMark || editedMark) ? (
            <span className="flex items-center gap-1 text-slate-400">
              {emailMark}
              {editedMark}
            </span>
          ) : null}
          {error ? <p className="mt-1 text-caption text-rose-600">{error}</p> : null}
        </div>
        {actionsMenu ? (
          <div className="shrink-0 pt-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
            {actionsMenu}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 ${
        outbound ? "justify-end" : "justify-start"
      }`}
    >
      {!outbound ? (
        reply.as_ava ? <AvaHalo size={36} /> : <SupportChatAvatar name={name} avatarUrl={avatarUrl} />
      ) : null}
      <div
        className={`min-w-0 max-w-[min(85%,26rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ring-1 ${
          outbound
            ? "rounded-br-md bg-sky-100/90 text-sky-950 ring-sky-200/70"
            : "rounded-bl-md bg-white text-slate-900 ring-slate-200/80"
        }`}
      >
        {content}
        <div
          className={`mt-1.5 flex items-center gap-1 ${
            outbound ? "justify-end" : "justify-start"
          } ${metaTone}`}
        >
          <span className="text-caption tabular-nums">
            {formatShortTime(reply.created_at)}
          </span>
          {emailMark}
          {editedMark}
          {actionsMenu}
        </div>
        {error ? (
          <p
            className={
              outbound
                ? "mt-1 text-caption text-rose-800"
                : "mt-1 text-caption text-rose-600"
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
  onUpdateNoteBody?: (noteId: string, body: string) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
  layout?: SupportThreadLayout;
  /** The opening message's time: skip a day line for that day, it's already shown. */
  openedAt?: string;
  /** BCA ticks a coach's message "Seen" instead of replying (5 Nov). Shows the ticks when given. */
  onSeen?: (replyId: string, seen: boolean) => void;
};

/** Slack groups messages from the same person within five minutes. */
const CONTINUED_WITHIN_MS = 5 * 60 * 1000;

export function SupportChatThread({
  replies,
  notes = [],
  viewerId,
  perspective,
  emptyLabel,
  onUpdateReplyBody,
  onDeleteReply,
  onUpdateNoteBody,
  onDeleteNote,
  layout = "bubbles",
  openedAt,
  onSeen,
}: ThreadProps) {
  const slack = layout === "slack";
  const cards = layout === "cards";
  const lastReplyId = replies.filter((r) => !r.origin).at(-1)?.id;
  const canManageReplies =
    perspective === "admin" &&
    Boolean(onUpdateReplyBody || onDeleteReply);
  const canManageNotes =
    perspective === "admin" && Boolean(onUpdateNoteBody || onDeleteNote);

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
    <div className={slack ? "space-y-2" : cards ? "space-y-1" : "space-y-3"}>
      {byDay.map((group) => (
        <div key={group.key} className={slack ? "" : cards ? "space-y-1" : "space-y-3"}>
          {/* Cards: each message carries its own date, as the coach's chat does. */}
          {cards || (slack && openedAt && calendarDayKey(openedAt) === group.key) ? null : slack ? (
            <div className="flex items-center gap-3 py-2">
              <span className="h-px flex-1 bg-slate-200" aria-hidden />
              <span className="text-caption font-medium text-slate-500">{group.label}</span>
              <span className="h-px flex-1 bg-slate-200" aria-hidden />
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <span className="rounded-full bg-white/90 px-3 py-0.5 text-caption font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                {group.label}
              </span>
            </div>
          )}
          {group.items.map((item, index) => {
            if (item.kind === "note") {
              return (
                <SupportInternalNoteCard
                  key={item.note.id}
                  note={item.note}
                  canManage={canManageNotes}
                  onUpdateBody={onUpdateNoteBody}
                  onDelete={onDeleteNote}
                />
              );
            }

            const reply = item.reply;
            const staff = isSupportStaffAuthor(reply.author);
            const mine = viewerId != null && reply.created_by === viewerId;
            const outbound =
              perspective === "admin" ? staff || mine : mine && !staff;
            const prev = index > 0 ? group.items[index - 1] : null;
            const continued =
              slack &&
              prev?.kind === "reply" &&
              prev.reply.created_by === reply.created_by &&
              prev.reply.origin?.label === reply.origin?.label &&
              new Date(reply.created_at).getTime() -
                new Date(prev.reply.created_at).getTime() <
                CONTINUED_WITHIN_MS;

            const bubble = (
              <SupportChatBubble
                key={reply.id}
                reply={reply}
                outbound={outbound}
                layout={layout}
                continued={continued}
                canManage={canManageReplies && !reply.origin}
                showEmailChannel={perspective === "admin"}
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
            if (!onSeen || reply.origin) return bubble;
            // BCA's own messages show the coach's tick; the coach's get BCA's tick button.
            const bcaWrote = staff || Boolean(reply.as_ava);
            if (cards) {
              return (
                <div key={reply.id} className="group/msg">
                  <SupportChatBubble
                    reply={reply}
                    outbound={outbound}
                    layout="cards"
                    canManage={canManageReplies && !reply.origin}
                    showEmailChannel={perspective === "admin"}
                    onUpdateBody={onUpdateReplyBody}
                    onDelete={onDeleteReply}
                    fallbackName={staff ? "Support" : perspective === "member" ? "You" : "Member"}
                    meta={
                      <SeenTick
                        inline
                        seenAt={reply.seen_at ?? null}
                        seenName={reply.seen_name ?? null}
                        canTick={!bcaWrote}
                        latest={reply.id === lastReplyId}
                        onTick={(seen) => onSeen(reply.id, seen)}
                      />
                    }
                  />
                </div>
              );
            }
            return (
              <div key={reply.id} className="group/msg">
                {bubble}
                <div className={slack ? "pl-14" : outbound ? "flex justify-end pr-11" : "pl-11"}>
                  <SeenTick
                    seenAt={reply.seen_at ?? null}
                    seenName={reply.seen_name ?? null}
                    canTick={!bcaWrote}
                    latest={reply.id === lastReplyId}
                    onTick={(seen) => onSeen(reply.id, seen)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function scheduledTimeLabel(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  const now = new Date();
  const sameDay =
    when.getFullYear() === now.getFullYear() &&
    when.getMonth() === now.getMonth() &&
    when.getDate() === now.getDate();
  return sameDay ? formatShortTime(iso) : formatShortDateTime(iso);
}

export function ScheduledSupportBubble({
  id,
  body,
  media: mediaRaw,
  scheduledFor,
  status,
  lastError,
  emailNotify,
  author,
  busy = false,
  onSaveBody,
  onReschedule,
  onDelete,
}: {
  id: string;
  body: string;
  media?: unknown;
  scheduledFor: string;
  status: string;
  lastError?: string | null;
  emailNotify?: boolean;
  author?: SupportTicketAuthor | null;
  busy?: boolean;
  onSaveBody: (id: string, body: string) => Promise<void>;
  onReschedule: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const name = authorDisplayName(author) || "Support";
  const media = parseSupportReplyMedia(mediaRaw);
  const failed = status === "failed";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const locked = busy || saving;
  const canSave = draft.trim().length > 0 || media.length > 0;

  useEffect(() => {
    if (!editing) setDraft(body);
  }, [editing, body]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  async function saveEdit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSave || locked) return;
    if (draft.trim() === body.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveBody(id, draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (locked) return;
    const confirmed = window.confirm(
      "Delete this scheduled reply? It will not be sent."
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setSaving(false);
    }
  }

  return (
    <div className="flex items-end justify-end gap-2">
      <div className="min-w-0 max-w-[min(85%,26rem)] rounded-2xl rounded-br-md bg-sky-100/90 px-3.5 py-2.5 text-sm text-sky-950 shadow-sm ring-1 ring-sky-200/70">
        {editing ? (
          <form onSubmit={(e) => void saveEdit(e)} className="space-y-2">
            <textarea
              ref={textareaRef}
              rows={3}
              value={draft}
              disabled={locked}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                  setError(null);
                  setDraft(body);
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
                disabled={locked}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setDraft(body);
                }}
                className={buttonClass("quiet", "small")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={locked || !canSave}
                className={buttonClass("main", "small")}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {body.trim() ? <SupportMessageBody body={body} /> : null}
            {media.length > 0 ? (
              <div className="mt-2">
                <CommunityPostMediaGallery items={media} variant="compact" />
              </div>
            ) : null}
          </>
        )}
        <div className="mt-1.5 flex items-center justify-end gap-1 text-sky-800/55">
          <span
            className={badgeClass(failed ? "red" : "amber")}
          >
            {failed ? "Failed" : "Scheduled"}
          </span>
          <span className="text-caption tabular-nums">
            {scheduledTimeLabel(scheduledFor)}
          </span>
          {emailNotify ? (
            <SupportViaEmailMark
              className="opacity-80"
              label="Will also email them"
            />
          ) : null}
          {!editing ? (
            <ScheduledSupportActionsMenu
              messageId={id}
              busy={locked}
              onEdit={() => {
                setDraft(body);
                setError(null);
                setEditing(true);
              }}
              onReschedule={() => onReschedule(id)}
              onDelete={() => void handleDelete()}
            />
          ) : null}
        </div>
        {failed && lastError ? (
          <p className="mt-1 text-caption text-rose-800">{lastError}</p>
        ) : null}
        {error ? <p className="mt-1 text-caption text-rose-800">{error}</p> : null}
      </div>
      <SupportChatAvatar name={name} avatarUrl={author?.avatar_url} tone="sky" />
    </div>
  );
}

function ScheduledSupportActionsMenu({
  messageId,
  busy,
  onEdit,
  onReschedule,
  onDelete,
}: {
  messageId: string;
  busy: boolean;
  onEdit: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = `scheduled-support-actions-${messageId}`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
        className={menuTriggerClass(true, open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label="Scheduled reply actions"
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
          className="absolute right-0 z-30 mt-0.5 min-w-[9rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-0.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5"
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
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => {
              setOpen(false);
              onReschedule();
            }}
          >
            <Clock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            Change time
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

export function supportAuthorShortName(
  author: SupportTicketAuthor | null | undefined
): string {
  if (!author) return "Support";
  const first = author.first_name?.trim();
  if (first) return first;
  return authorDisplayName(author);
}
