"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

import { notifySupportCountsChanged } from "@/components/layout/useNewFeedbackCount";
import { getSessionUser } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import type { HelpAnswer } from "@/lib/help/helpAnswers";

type Row = { helpful: boolean; ticket_id: string | null };

/**
 * "Did this answer your question?" under a Help answer. Yes or No is saved per
 * person (they can change it). After a No we ask what they still need, and
 * that becomes a Support chat about this answer. Admins also see the totals.
 */
export function HelpAnswerFeedback({ answer, admin }: { answer: HelpAnswer; admin: boolean }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [vote, setVote] = useState<boolean | null>(null);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ yes: number; no: number } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const user = await getSessionUser();
      if (!live || !user?.id) return;
      setUserId(user.id);
      const { data } = await supabaseClient
        .from("help_answer_feedback")
        .select("helpful, ticket_id")
        .eq("answer_id", answer.id)
        .eq("created_by", user.id)
        .maybeSingle();
      const row = data as Row | null;
      if (live && row) {
        setVote(row.helpful);
        setSent(Boolean(row.ticket_id));
      }
      if (!admin) return;
      const { data: all } = await supabaseClient.from("help_answer_feedback").select("helpful").eq("answer_id", answer.id);
      if (!live || !all) return;
      const yes = all.filter((r) => r.helpful).length;
      setTotals({ yes, no: all.length - yes });
    })();
    return () => {
      live = false;
    };
  }, [answer.id, admin]);

  async function choose(helpful: boolean) {
    if (!userId || busy || vote === helpful) return;
    setError(null);
    const before = vote;
    setVote(helpful);
    const { error: saveError } = await supabaseClient
      .from("help_answer_feedback")
      .upsert(
        { answer_id: answer.id, created_by: userId, helpful, updated_at: new Date().toISOString() },
        { onConflict: "answer_id,created_by" }
      );
    if (saveError) {
      setVote(before);
      setError("That didn't save. Try again.");
      return;
    }
    if (totals) {
      let { yes, no } = totals;
      if (before === true) yes -= 1;
      if (before === false) no -= 1;
      if (helpful) yes += 1;
      else no += 1;
      setTotals({ yes, no });
    }
  }

  async function send() {
    const text = note.trim();
    if (!userId || busy || !text) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: ticketError } = await supabaseClient
        .from("community_feedback_reports")
        .insert({
          created_by: userId,
          type: "question",
          title: `Help: ${answer.question}`,
          details: text,
          status: "open",
          context_path: `/coach/support?tab=help&a=${answer.id}`,
          page_path: window.location.pathname + window.location.search,
          user_agent: navigator.userAgent,
        })
        .select("id")
        .single();
      if (ticketError || !data) throw ticketError ?? new Error("No ticket");
      await supabaseClient
        .from("help_answer_feedback")
        .update({ comment: text, ticket_id: (data as { id: string }).id, updated_at: new Date().toISOString() })
        .eq("answer_id", answer.id)
        .eq("created_by", userId);
      notifySupportCountsChanged();
      setSent(true);
      setNote("");
    } catch {
      setError("That didn't send. Try again, or start a chat below.");
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-default";
  const yesClass =
    vote === true
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  const noClass =
    vote === false
      ? "border-rose-600 bg-rose-600 text-white"
      : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";

  return (
    <section className="mt-10 border-t border-[#e8edf3] pt-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 className="text-base font-semibold text-[#0b1b2e]">Did this answer your question?</h2>
        <div className="flex gap-2">
          <button type="button" className={`${base} ${yesClass}`} aria-pressed={vote === true} disabled={!userId} onClick={() => void choose(true)}>
            <ThumbsUp className="h-4 w-4" aria-hidden />
            Yes
          </button>
          <button type="button" className={`${base} ${noClass}`} aria-pressed={vote === false} disabled={!userId} onClick={() => void choose(false)}>
            <ThumbsDown className="h-4 w-4" aria-hidden />
            No
          </button>
        </div>
      </div>

      {vote === true ? <div className="mt-3 text-sm text-[#55657a]">Thanks. Glad it helped.</div> : null}

      {vote === false && sent ? (
        <div className="mt-3 text-sm text-[#55657a]">
          Thanks for telling us. Pam or Zander replies in your{" "}
          <Link href="/coach/support" className="font-medium text-[#0c5290] underline underline-offset-4">
            Support chats
          </Link>{" "}
          within a working day.
        </div>
      ) : null}

      {vote === false && !sent ? (
        <div className="mt-4 rounded-lg border border-[#e8edf3] bg-[#f8fafc] p-4">
          <label htmlFor={`hc-more-${answer.id}`} className="block text-sm font-semibold text-[#0b1b2e]">
            Sorry about that. What do you still need help with?
          </label>
          <textarea
            id={`hc-more-${answer.id}`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tell us what you were trying to do, or which part was confusing."
            className="mt-2 w-full resize-y rounded-md border border-[#d5dde7] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#8595a8] focus:border-[#0c5290] focus:outline-none focus:ring-2 focus:ring-[#0c5290]/20"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !note.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-[#0c5290] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4578] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Send to Support
            </button>
            <span className="text-xs text-[#55657a]">Pam and Zander see it and reply within a working day.</span>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-3 text-sm text-rose-700">{error}</div> : null}

      {admin && totals ? (
        <div className="mt-3 text-xs text-[#8595a8]">
          Admin: {totals.yes} said yes, {totals.no} said no.
        </div>
      ) : null}
    </section>
  );
}
