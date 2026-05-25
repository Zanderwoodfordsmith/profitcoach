"use client";

import { useState } from "react";
import { Bug, Lightbulb, MessageSquare } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";

type FeedbackFormCardProps = {
  onSubmitted?: () => void;
};

type FeedbackType = "bug" | "feature" | "general";

const FEEDBACK_DETAILS_PLACEHOLDER =
  "Bug: what happened and what you expected.\nFeature idea: what you'd like added and how you'd use it.";

const FEEDBACK_TYPE_OPTIONS: {
  value: FeedbackType;
  label: string;
  icon: typeof Bug;
  selectedClassName: string;
  unselectedClassName: string;
}[] = [
  {
    value: "feature",
    label: "Feature",
    icon: Lightbulb,
    selectedClassName:
      "bg-sky-100 text-sky-800 ring-sky-300/80 hover:bg-sky-100",
    unselectedClassName:
      "bg-white text-slate-600 ring-slate-200 hover:bg-sky-50/70 hover:text-sky-800",
  },
  {
    value: "bug",
    label: "Bug",
    icon: Bug,
    selectedClassName:
      "bg-rose-100 text-rose-800 ring-rose-300/80 hover:bg-rose-100",
    unselectedClassName:
      "bg-white text-slate-600 ring-slate-200 hover:bg-rose-50/70 hover:text-rose-800",
  },
  {
    value: "general",
    label: "General",
    icon: MessageSquare,
    selectedClassName:
      "bg-violet-100 text-violet-800 ring-violet-300/80 hover:bg-violet-100",
    unselectedClassName:
      "bg-white text-slate-600 ring-slate-200 hover:bg-violet-50/70 hover:text-violet-800",
  },
];

export function FeedbackFormCard({ onSubmitted }: FeedbackFormCardProps = {}) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("feature");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDetails, setFeedbackDetails] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">
        💡 Got an idea?
      </h2>
      <p className="mt-2 text-base leading-relaxed text-slate-600">
        Share feedback, suggest a feature, or report an issue.
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (feedbackBusy || !feedbackTitle.trim()) return;
          setFeedbackBusy(true);
          setFeedbackError(null);
          setFeedbackSuccess(null);
          void (async () => {
            try {
              const {
                data: { user },
              } = await supabaseClient.auth.getUser();
              if (!user?.id) throw new Error("Could not determine your account.");
              const { error } = await supabaseClient
                .from("community_feedback_reports")
                .insert({
                  created_by: user.id,
                  type: feedbackType,
                  title: feedbackTitle.trim(),
                  details: feedbackDetails.trim(),
                  page_path:
                    typeof window !== "undefined"
                      ? window.location.pathname + window.location.search
                      : null,
                  user_agent:
                    typeof navigator !== "undefined" ? navigator.userAgent : null,
                });
              if (error) throw error;
              setFeedbackSuccess("Thanks — your feedback has been submitted.");
              setFeedbackType("feature");
              setFeedbackTitle("");
              setFeedbackDetails("");
              onSubmitted?.();
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : "Could not submit feedback.";
              setFeedbackError(msg);
            } finally {
              setFeedbackBusy(false);
            }
          })();
        }}
      >
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            Title
          </label>
          <input
            type="text"
            required
            value={feedbackTitle}
            onChange={(e) => setFeedbackTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            placeholder="Short summary"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            Details (optional)
          </label>
          <textarea
            rows={4}
            value={feedbackDetails}
            onChange={(e) => setFeedbackDetails(e.target.value)}
            className="w-full resize-y rounded-lg border border-slate-300 px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            placeholder={FEEDBACK_DETAILS_PLACEHOLDER}
          />
        </div>
        {feedbackError ? (
          <p className="text-sm text-rose-600">{feedbackError}</p>
        ) : null}
        {feedbackSuccess ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-base font-semibold text-emerald-700">
            {feedbackSuccess}
          </p>
        ) : null}
        <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Type
            </span>
            <div
              role="radiogroup"
              aria-label="Feedback type"
              className="flex flex-wrap gap-2"
            >
              {FEEDBACK_TYPE_OPTIONS.map(
                ({ value, label, icon: Icon, selectedClassName, unselectedClassName }) => {
                  const selected = feedbackType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setFeedbackType(value)}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 text-base font-semibold ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
                        selected ? selectedClassName : unselectedClassName
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      {label}
                    </button>
                  );
                }
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={feedbackBusy || !feedbackTitle.trim()}
            className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50 sm:shrink-0"
          >
            {feedbackBusy ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </section>
  );
}
