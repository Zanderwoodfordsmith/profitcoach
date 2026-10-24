"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import { figtree } from "@/fonts";

import { useSimApi } from "./simApi";
import "./sim.css";

type Draft = { title: string; body: string; shared: boolean };

/**
 * Share a practice session with the community: a ready-made post the coach
 * can edit, with or without the score, linking to the report and recording.
 */
export function ShareSession({ sessionId, shared, onClose }: { sessionId: string; shared: boolean; onClose: (changed: boolean) => void }) {
  const api = useSimApi();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showScore, setShowScore] = useState(true);
  const [category, setCategory] = useState<"feedback" | "wins">("feedback");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<Draft>(`/api/coach/simulator/sessions/${sessionId}/share`);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitle(res.data.title);
      setBody(res.data.body);
    })();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
    };
  }, [api, sessionId, onClose]);

  async function post() {
    setPosting(true);
    setError(null);
    const res = await api<{ postId: string }>(`/api/coach/simulator/sessions/${sessionId}/share`, {
      method: "POST",
      body: { title, body, showScore, category },
    });
    setPosting(false);
    if (!res.ok) setError(res.error);
    else setPosted(true);
  }

  async function stop() {
    await api(`/api/coach/simulator/sessions/${sessionId}/share`, { method: "DELETE" });
    onClose(true);
  }

  // The score line disappears from the preview as soon as it's hidden.
  const shownBody = showScore ? body : body.replace(/I scored \d+ out of 50\.\s*/g, "");

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`sim ${figtree.className} fixed inset-0 z-[100] grid place-items-center bg-[rgba(4,16,30,0.6)] p-4`} role="dialog" aria-modal="true" aria-label="Share with the community">
      <div className="sim-room w-full max-w-xl rounded-[1.75rem] p-6 shadow-2xl sm:p-8">
        <div className="relative z-[2]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--sim-cream-faint)]">Share with the community</p>
              <p className="mt-1 text-xl font-light text-[var(--sim-cream)]">Other coaches can read the report and listen back.</p>
            </div>
            <button type="button" onClick={() => onClose(posted)} className="rounded-full p-1.5 text-[var(--sim-cream-soft)] hover:text-[var(--sim-cream)]" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <p className="mt-8 flex items-center gap-2 text-[var(--sim-cream-soft)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing a post for you…
            </p>
          ) : posted ? (
            <div className="mt-6">
              <p className="text-[var(--sim-cream)]">Posted in the community. Coaches who open it can see your report and play the call.</p>
              <button type="button" className="sim-pill sim-pill-solid mt-5" onClick={() => onClose(true)}>
                Done
              </button>
            </div>
          ) : (
            <>
              <label className="mt-6 block text-sm text-[var(--sim-cream-soft)]">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--sim-cream-line)] bg-[rgba(5,30,54,0.5)] px-3.5 py-2.5 text-[0.9375rem] text-[var(--sim-cream)] outline-none focus:border-[var(--sim-cream)]"
                />
              </label>
              <label className="mt-4 block text-sm text-[var(--sim-cream-soft)]">
                Post
                <textarea
                  value={shownBody}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="sim-scroll mt-1.5 w-full resize-y rounded-xl border border-[var(--sim-cream-line)] bg-[rgba(5,30,54,0.5)] px-3.5 py-2.5 text-[0.9375rem] leading-relaxed text-[var(--sim-cream)] outline-none focus:border-[var(--sim-cream)]"
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[var(--sim-cream-soft)]">
                <div className="flex items-center gap-2.5">
                  Score
                  <div className="sim-seg" role="group" aria-label="Show the score">
                    <button type="button" aria-pressed={showScore} onClick={() => setShowScore(true)}>
                      Show
                    </button>
                    <button type="button" aria-pressed={!showScore} onClick={() => setShowScore(false)}>
                      Hide
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  Post in
                  <div className="sim-seg" role="group" aria-label="Community category">
                    <button type="button" aria-pressed={category === "feedback"} onClick={() => setCategory("feedback")}>
                      Feedback
                    </button>
                    <button type="button" aria-pressed={category === "wins"} onClick={() => setCategory("wins")}>
                      Wins
                    </button>
                  </div>
                </div>
              </div>
              {error ? <p className="mt-4 text-sm text-[var(--sim-amber)]">{error}</p> : null}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button type="button" className="sim-pill sim-pill-solid" disabled={posting || !title.trim() || !body.trim()} onClick={() => void post()}>
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Post it
                </button>
                <button type="button" className="sim-pill sim-pill-line" onClick={() => onClose(false)}>
                  Cancel
                </button>
                {shared ? (
                  <button type="button" onClick={() => void stop()} className="ml-auto text-sm text-[var(--sim-cream-soft)] underline-offset-2 hover:text-[var(--sim-cream)] hover:underline">
                    Stop sharing the report
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
