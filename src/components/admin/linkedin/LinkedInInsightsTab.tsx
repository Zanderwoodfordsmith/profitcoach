"use client";

import { useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import type { LinkedInPostItem } from "./types";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

type Engagement = {
  comments?: number;
  reactions?: number;
  comment_preview?: Array<{
    id?: unknown;
    text?: unknown;
    author?: string | null;
  }>;
  reaction_types?: Record<string, number>;
  errors?: string[];
};

export function LinkedInInsightsTab({
  items,
  getToken,
  onMessage,
}: {
  items: LinkedInPostItem[];
  getToken: () => Promise<string>;
  onMessage: (message: string, tone: "success" | "error" | "neutral") => void;
}) {
  const published = items.filter(
    (i) => i.status === "published" && i.linkedin_post_urn
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [byId, setById] = useState<Record<string, Engagement>>({});

  async function sync(id: string) {
    setBusyId(id);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/linkedin/posts/${encodeURIComponent(id)}/engagement`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        engagement?: Engagement;
      };
      if (!res.ok) throw new Error(body.error || "Could not load engagement.");
      setById((prev) => ({ ...prev, [id]: body.engagement ?? {} }));
      onMessage("Engagement updated", "success");
    } catch (err) {
      onMessage(
        err instanceof Error ? err.message : "Engagement sync failed.",
        "error"
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!published.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8 text-center">
        <BarChart3 className="mx-auto h-6 w-6 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-800">
          Nothing published from here yet
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Posts you publish from Compose show their comments and reactions here.
        </p>
      </div>
    );
  }

  return (
    <section>
    <h3 className="mb-3 text-sm font-semibold text-slate-900">Published from here</h3>
    <ul className={cardClass("plain", "divide-y divide-slate-100 overflow-hidden")}>
      {published.map((post) => {
        const eng = byId[post.id] || post.engagement || undefined;
        return (
          <li key={post.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-slate-900">
                  {post.content || "(media post)"}
                </p>
                <p className="mt-1 text-caption text-slate-400">
                  {post.published_at
                    ? new Date(post.published_at).toLocaleString()
                    : "Published"}
                </p>
                {eng ? (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {eng.reactions ?? 0}
                      </span>{" "}
                      reactions
                    </span>
                    <span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {eng.comments ?? 0}
                      </span>{" "}
                      comments
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Not synced yet
                  </p>
                )}
                {eng?.comment_preview?.length ? (
                  <ul className="mt-3 space-y-1.5 border-t border-slate-50 pt-3">
                    {eng.comment_preview.slice(0, 3).map((c, i) => (
                      <li
                        key={String(c.id ?? i)}
                        className="text-xs text-slate-600"
                      >
                        <span className="font-medium text-slate-800">
                          {c.author || "Someone"}
                        </span>
                        {": "}
                        {String(c.text || "").slice(0, 120)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyId === post.id}
                onClick={() => void sync(post.id)}
                className={buttonClass("second", "small", "shrink-0")}
              >
                {busyId === post.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sync
              </button>
            </div>
          </li>
        );
      })}
    </ul>
    </section>
  );
}
