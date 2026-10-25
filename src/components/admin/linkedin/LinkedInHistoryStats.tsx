"use client";

import { ArrowUpRight, Loader2 } from "lucide-react";
import type { LinkedInHistoryPayload } from "@/lib/linkedinHistory/loadHistory";
import { daysAgoLabel } from "./useLinkedInHistory";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={cardClass("plain", "px-4 py-3.5")}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.02em] text-slate-900">{value}</p>
      {note ? <p className="mt-0.5 text-caption text-slate-400">{note}</p> : null}
    </div>
  );
}

/** Posting rhythm and the posts that landed best, from the coach's imported LinkedIn history. */
export function LinkedInHistoryStats({
  history,
  loading,
  importing,
  onImport,
  bestCount = 5,
}: {
  history: LinkedInHistoryPayload | null;
  loading: boolean;
  importing: boolean;
  onImport?: () => void;
  bestCount?: number;
}) {
  const best = (history?.best_posts ?? []).slice(0, bestCount);

  if (loading && !history) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading LinkedIn history…
      </div>
    );
  }
  if (!history) return null;

  if (!history.last_import?.last_ok_at) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">See how your LinkedIn is doing</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {history.connected
              ? "Import your past posts and newsletter issues to see how often you post and what lands."
              : "Connect LinkedIn first, then import your past posts."}
          </p>
          {history.last_import?.last_error ? <p className="mt-1 text-xs text-rose-700">Last try: {history.last_import.last_error}</p> : null}
        </div>
        {history.connected && onImport ? (
          <button
            type="button"
            onClick={onImport}
            disabled={importing}
            className={buttonClass("main")}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {importing ? "Importing…" : "Import from LinkedIn"}
          </button>
        ) : null}
      </div>
    );
  }

  const s = history.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Posts, last 30 days" value={String(s.posts_30d)} note={`${s.posts_90d} in the last 90 days`} />
        <Tile label="Last post" value={daysAgoLabel(s.last_post_days)} note={`${s.total_posts.toLocaleString("en-GB")} posts in all`} />
        <Tile
          label="Typical views"
          value={s.median_impressions_90d != null ? s.median_impressions_90d.toLocaleString("en-GB") : "–"}
          note="Per post, last 90 days"
        />
        <Tile label="Newsletter issues" value={String(s.issues_90d)} note={`Last 90 days · last one ${daysAgoLabel(s.last_issue_days)}`} />
      </div>

      {best.length ? (
        <section className={cardClass("plain", "overflow-hidden")}>
          <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Best posts, last 90 days</h3>
          <ol className="divide-y divide-slate-100">
            {best.map((post) => (
              <li key={post.id}>
                <a
                  href={post.share_url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">
                      {new Date(post.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {post.kind === "newsletter" ? " · Newsletter" : ""}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-800">{post.text || "Post"}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums text-slate-500">
                    <p className="font-semibold text-slate-900">{post.impressions.toLocaleString("en-GB")} views</p>
                    <p>
                      {post.reactions} reactions · {post.comments} comments
                    </p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
