"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export function FeedbackFormCard() {
  const [feedbackType, setFeedbackType] = useState<"bug" | "feature" | "general">(
    "bug"
  );
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDetails, setFeedbackDetails] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Report an issue or share feedback
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        This goes directly to admins for review.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!feedbackDetails.trim() || feedbackBusy) return;
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
                  title: feedbackTitle.trim() || null,
                  details: feedbackDetails.trim(),
                  contact_email: feedbackEmail.trim() || null,
                  page_path:
                    typeof window !== "undefined"
                      ? window.location.pathname + window.location.search
                      : null,
                  user_agent:
                    typeof navigator !== "undefined" ? navigator.userAgent : null,
                });
              if (error) throw error;
              setFeedbackSuccess("Thanks — your feedback has been submitted.");
              setFeedbackType("bug");
              setFeedbackTitle("");
              setFeedbackDetails("");
              setFeedbackEmail("");
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
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Type
          </label>
          <select
            value={feedbackType}
            onChange={(e) =>
              setFeedbackType(e.target.value as "bug" | "feature" | "general")
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="bug">Bug</option>
            <option value="feature">Feature request</option>
            <option value="general">General feedback</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Title (optional)
          </label>
          <input
            type="text"
            value={feedbackTitle}
            onChange={(e) => setFeedbackTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            placeholder="Short summary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Details
          </label>
          <textarea
            rows={6}
            required
            value={feedbackDetails}
            onChange={(e) => setFeedbackDetails(e.target.value)}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            placeholder="What happened? What did you expect?"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Contact email (optional)
          </label>
          <input
            type="email"
            value={feedbackEmail}
            onChange={(e) => setFeedbackEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            placeholder="name@company.com"
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
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={feedbackBusy || !feedbackDetails.trim()}
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {feedbackBusy ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </section>
  );
}
