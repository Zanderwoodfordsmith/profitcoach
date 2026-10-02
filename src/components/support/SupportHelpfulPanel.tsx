"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { SupportTicketStatus } from "@/lib/support/tickets";

export type SupportTicketFeedback = {
  helpful: boolean;
  comment: string | null;
  reply_id: string | null;
};

type Props = {
  reportId: string;
  /** Latest staff reply. Feedback is about this answer. */
  replyId: string | null;
  viewerId: string;
  /** False while an admin is previewing the member's inbox. */
  canAnswer: boolean;
  existing: SupportTicketFeedback | null;
  onChange: (next: SupportTicketFeedback) => void;
};

export function SupportHelpfulPanel({
  reportId,
  replyId,
  viewerId,
  canAnswer,
  existing,
  onChange,
}: Props) {
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setComment(existing?.comment ?? "");
    setError(null);
  }, [reportId, existing?.comment, existing?.helpful]);

  async function save(helpful: boolean, nextComment: string) {
    if (!canAnswer || !replyId) return;
    setBusy(true);
    setError(null);
    const trimmed = nextComment.trim();
    const row = {
      report_id: reportId,
      reply_id: replyId,
      created_by: viewerId,
      helpful,
      comment: trimmed || null,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await supabaseClient
      .from("support_ticket_feedback")
      .upsert(row, { onConflict: "report_id,created_by" });
    setBusy(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onChange({
      helpful,
      comment: trimmed || null,
      reply_id: replyId,
    });
  }

  const helpful = existing?.helpful === true;
  const notYet = existing?.helpful === false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-950">
          Did this sort it out?
        </h2>
        <p className="mb-1 mt-2.5 text-sm leading-snug text-slate-600">
          Was this reply helpful? It tells us which answers to keep using.
        </p>

        {!replyId ? (
          <p className="mt-4 text-sm text-slate-600">
            We&apos;ll ask once there&apos;s a reply on this ticket.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {!canAnswer ? (
              <p className="text-sm leading-snug text-slate-600">
                {existing
                  ? existing.helpful
                    ? "They said this helped."
                    : "They said this has not sorted it yet."
                  : "Only they can answer this, from their own account."}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy || !canAnswer}
                aria-pressed={helpful}
                onClick={() => void save(true, "")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-60 ${
                  helpful
                    ? "bg-emerald-600 text-white ring-emerald-700"
                    : "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100"
                }`}
              >
                <ThumbsUp className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Yes
              </button>
              <button
                type="button"
                disabled={busy || !canAnswer}
                aria-pressed={notYet}
                onClick={() => void save(false, comment)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 disabled:opacity-60 ${
                  notYet
                    ? "bg-rose-600 text-white ring-rose-700"
                    : "bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100"
                }`}
              >
                <ThumbsDown
                  className="h-4 w-4"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Not yet
              </button>
            </div>

            {helpful ? (
              <p className="text-sm text-slate-700">Glad that helped.</p>
            ) : null}

            {notYet && canAnswer ? (
              <form
                className="block"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(false, comment);
                }}
              >
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    What still isn&apos;t sorted?
                  </span>
                  <textarea
                    value={comment}
                    disabled={busy}
                    rows={4}
                    maxLength={2000}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what still needs doing"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    busy || comment.trim() === (existing?.comment ?? "")
                  }
                  className="mt-2 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Send note
                </button>
                {existing?.comment &&
                comment.trim() === existing.comment ? (
                  <p className="mt-2 text-sm text-slate-600">Note sent.</p>
                ) : null}
              </form>
            ) : null}
            {notYet && !canAnswer && existing?.comment ? (
              <p className="text-sm leading-snug text-slate-700">
                {existing.comment}
              </p>
            ) : null}

            {error ? (
              <p className="text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function SupportTicketActions({
  reportId,
  status,
  canChange,
  onStatus,
  onDeleted,
}: {
  reportId: string;
  status: SupportTicketStatus;
  canChange: boolean;
  onStatus: (status: SupportTicketStatus) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = status === "resolved";

  useEffect(() => {
    setError(null);
  }, [reportId, status]);

  async function setStatus(next: "open" | "resolved") {
    if (!canChange || busy) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabaseClient.rpc(
      "member_set_support_ticket_status",
      { p_report_id: reportId, p_status: next }
    );
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onStatus(next);
  }

  async function removeTicket() {
    if (!canChange || busy) return;
    const ok = window.confirm(
      "Delete this ticket? It will be gone, and this can't be undone."
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabaseClient.rpc(
      "member_delete_support_ticket",
      { p_report_id: reportId }
    );
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDeleted();
  }

  return (
    <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-semibold text-slate-950">This ticket</h2>
      {canChange ? (
        <p className="mt-1 text-sm leading-snug text-slate-600">
          Mark it resolved when you&apos;re done, or delete it if you don&apos;t
          need it.
        </p>
      ) : (
        <p className="mt-1 text-sm leading-snug text-slate-600">
          Only they can close or delete this ticket.
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy || !canChange}
          onClick={() => void setStatus(resolved ? "open" : "resolved")}
          className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resolved ? "Reopen" : "Mark resolved"}
        </button>
        <button
          type="button"
          disabled={busy || !canChange}
          onClick={() => void removeTicket()}
          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete ticket
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
