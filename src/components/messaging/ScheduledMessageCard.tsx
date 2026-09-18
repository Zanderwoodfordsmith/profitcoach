"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Clock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatShortDateTime } from "@/lib/formatShortDate";

export type ScheduledThreadMessage = {
  id: string;
  channel: string;
  body_text: string | null;
  scheduled_for: string;
  status: string;
  last_error: string | null;
};

function ActionsMenu({
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
  const menuId = `scheduled-msg-actions-${messageId}`;

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
        className={`rounded p-0.5 ${
          open
            ? "bg-amber-100 text-amber-900"
            : "text-amber-700/70 hover:bg-amber-100 hover:text-amber-950"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label="Scheduled message actions"
        disabled={busy}
        onClick={(event) => {
          stop(event);
          setOpen((v) => !v);
        }}
      >
        <MoreVertical className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
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

export function ScheduledMessageCard({
  message,
  busy,
  onSaveBody,
  onReschedule,
  onDelete,
}: {
  message: ScheduledThreadMessage;
  busy?: boolean;
  onSaveBody: (id: string, body: string) => Promise<void>;
  onReschedule: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body_text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const failed = message.status === "failed";

  useEffect(() => {
    if (!editing) setDraft(message.body_text ?? "");
  }, [editing, message.body_text]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  async function saveEdit(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    const next = draft;
    if (next.trim() === (message.body_text ?? "").trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveBody(message.id, next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (saving) return;
    const confirmed = window.confirm(
      "Delete this scheduled message? It will not be sent."
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete(message.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setSaving(false);
    }
  }

  const locked = Boolean(busy) || saving;

  return (
    <div className="flex justify-end px-1">
      <div className="min-w-0 max-w-[min(88%,28rem)] rounded-2xl rounded-br-md border border-dashed border-amber-300 bg-amber-50/90 px-3.5 py-2.5 text-sm text-amber-950 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            <Clock className="h-3 w-3" aria-hidden />
            {failed ? "Send failed" : "Scheduled to send"}
          </p>
          {!editing ? (
            <ActionsMenu
              messageId={message.id}
              busy={locked}
              onEdit={() => setEditing(true)}
              onReschedule={() => onReschedule(message.id)}
              onDelete={() => void handleDelete()}
            />
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums text-amber-800/80">
          {failed && message.last_error
            ? message.last_error
            : formatShortDateTime(message.scheduled_for)}
        </p>
        {editing ? (
          <form onSubmit={(e) => void saveEdit(e)} className="mt-2 space-y-2">
            <textarea
              ref={textareaRef}
              rows={4}
              value={draft}
              disabled={locked}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                  setError(null);
                  setDraft(message.body_text ?? "");
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void saveEdit();
                }
              }}
              className="w-full resize-y rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-sm text-amber-950 placeholder:text-amber-800/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
              placeholder="Message…"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setDraft(message.body_text ?? "");
                }}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-amber-900/80 hover:bg-amber-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={locked || !draft.trim()}
                className="rounded-md bg-amber-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-amber-950">
            {message.body_text?.trim() || "(No text)"}
          </p>
        )}
        {error ? <p className="mt-1.5 text-[11px] text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}
