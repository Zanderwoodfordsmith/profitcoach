"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  castCommunityPostPollVote,
  fetchCommunityPostPollTally,
  removeCommunityPostPollVote,
  type CommunityPostPoll as CommunityPostPollData,
  type CommunityPostPollTally,
} from "@/lib/communityPostPoll";
import { supabaseErrorMessage } from "@/lib/supabaseErrorMessage";

type Props = {
  postId: string;
  poll: CommunityPostPollData;
  /** Post author and admins see results before voting. */
  canSeeResultsWithoutVoting?: boolean;
  /** Called after a vote is cast, changed or removed. */
  onVoteChange?: (next: { total: number; myOptionId: string | null }) => void;
};

function applyVote(
  tally: CommunityPostPollTally,
  optionId: string | null
): CommunityPostPollTally {
  const counts = { ...tally.counts };
  let total = tally.total;
  if (tally.myOptionId) {
    counts[tally.myOptionId] = Math.max(0, (counts[tally.myOptionId] ?? 0) - 1);
    total -= 1;
  }
  if (optionId) {
    counts[optionId] = (counts[optionId] ?? 0) + 1;
    total += 1;
  }
  return { counts, total: Math.max(0, total), myOptionId: optionId };
}

export function CommunityPostPoll({
  postId,
  poll,
  canSeeResultsWithoutVoting = false,
  onVoteChange,
}: Props) {
  const [tally, setTally] = useState<CommunityPostPollTally | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTally(null);
    setError(null);
    void fetchCommunityPostPollTally(postId)
      .then((t) => {
        if (!cancelled) setTally(t);
      })
      .catch((err) => {
        if (!cancelled) setError(supabaseErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const vote = useCallback(
    async (optionId: string | null) => {
      if (!tally || busy) return;
      if (optionId === tally.myOptionId) return;
      const before = tally;
      const next = applyVote(tally, optionId);
      setTally(next);
      setBusy(true);
      setError(null);
      try {
        if (optionId) await castCommunityPostPollVote(postId, optionId);
        else await removeCommunityPostPollVote(postId);
        onVoteChange?.({ total: next.total, myOptionId: next.myOptionId });
      } catch (err) {
        setTally(before);
        setError(supabaseErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, onVoteChange, postId, tally]
  );

  const hasVoted = Boolean(tally?.myOptionId);
  const showResults = Boolean(tally) && (hasVoted || canSeeResultsWithoutVoting);
  const total = tally?.total ?? 0;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <ul className="space-y-2" role="radiogroup" aria-label="Poll options">
        {poll.options.map((option) => {
          const count = tally?.counts[option.id] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = tally?.myOptionId === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={mine}
                disabled={!tally || busy}
                onClick={() => void vote(option.id)}
                className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg border bg-white px-3 py-2.5 text-left text-[15px] transition disabled:cursor-default ${
                  mine
                    ? "border-sky-400 text-slate-900"
                    : "border-slate-200 text-slate-800 hover:border-slate-300"
                }`}
              >
                {showResults ? (
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${
                      mine ? "bg-sky-100" : "bg-slate-100"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    mine ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {mine ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className="relative min-w-0 flex-1 break-words font-medium">
                  {option.text}
                </span>
                {showResults ? (
                  <span className="relative shrink-0 text-sm font-semibold tabular-nums text-slate-600">
                    {pct}%
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {tally
            ? `${total} ${total === 1 ? "vote" : "votes"}${
                showResults ? "" : " · vote to see results"
              }`
            : error
              ? null
              : "Loading poll…"}
        </span>
        {hasVoted ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void vote(null)}
            className="font-semibold text-slate-500 hover:text-slate-700 hover:underline disabled:opacity-50"
          >
            Remove my vote
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
