"use client";

import { useMemo, useState } from "react";
import { Copy, Loader2, Pencil, Send, Trash2, XCircle } from "lucide-react";
import { formatShortDateTime } from "@/lib/linkedinScheduleTime";
import {
  postTypeLabel,
  statusBadgeTone,
  statusLabel,
  type LinkedInPostItem,
  type LinkedInPostStatus,
} from "./types";
import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

type Props = {
  items: LinkedInPostItem[];
  categories: string[];
  getToken: () => Promise<string>;
  onMessage: (message: string, tone: "success" | "error" | "neutral") => void;
  onRefresh: () => Promise<void>;
  onEdit: (item: LinkedInPostItem) => void;
};

const FILTERS: Array<{ id: "all" | LinkedInPostStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
];

function isOverdue(item: LinkedInPostItem): boolean {
  if (item.status !== "scheduled" || !item.scheduled_for) return false;
  return new Date(item.scheduled_for).getTime() <= Date.now();
}

export function LinkedInQueueTab({
  items,
  categories,
  getToken,
  onMessage,
  onRefresh,
  onEdit,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<"all" | LinkedInPostStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (item.status === "draft") return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      return true;
    });
  }, [items, statusFilter, categoryFilter]);

  const overdueCount = useMemo(
    () => items.filter((i) => isOverdue(i)).length,
    [items]
  );

  async function patch(id: string, action: "cancel" | "clone") {
    setBusyId(id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/linkedin/scheduled/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Action failed.");
      onMessage(
        action === "cancel" ? "Post cancelled." : "Cloned into library as draft.",
        "success"
      );
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(item: LinkedInPostItem) {
    const label =
      item.status === "published"
        ? "Remove this published post from the queue? (Does not delete it from LinkedIn.)"
        : "Delete this post from the queue?";
    if (!window.confirm(label)) return;
    setBusyId(item.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/linkedin/scheduled/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Delete failed.");
      onMessage("Removed from queue.", "success");
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Delete failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function publishNow(item: LinkedInPostItem) {
    setBusyId(item.id);
    try {
      const token = await getToken();
      const dueRes = await fetch("/api/linkedin/publish-due", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const dueBody = (await dueRes.json().catch(() => ({}))) as {
        published?: number;
        error?: string;
        results?: Array<{ id: string; ok: boolean; error?: string }>;
      };
      if (!dueRes.ok) throw new Error(dueBody.error || "Could not publish.");

      const thisResult = dueBody.results?.find((r) => r.id === item.id);
      if (thisResult?.ok) {
        onMessage("Posted to LinkedIn.", "success");
        await onRefresh();
        return;
      }

      const res = await fetch("/api/linkedin/post-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: item.content,
          post_type: item.post_type,
          category: item.category,
          article_url: item.article_url,
          article_title: item.article_title,
          article_description: item.article_description,
          article_thumbnail_url: item.article_thumbnail_url,
          media: item.media.map(({ path, mime, size, altText, filename }) => ({
            path,
            mime,
            size,
            altText,
            filename,
          })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        throw new Error(
          thisResult?.error || body.error || "Could not publish. Check last error on the row."
        );
      }
      await fetch(`/api/linkedin/scheduled/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      onMessage("Posted to LinkedIn.", "success");
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not publish.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {overdueCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            {overdueCount} post{overdueCount === 1 ? "" : "s"} past due
          </p>
          <p className="mt-0.5 text-caption text-amber-900/80">
            They publish automatically about every minute while this page is open. Use{" "}
            <span className="font-medium">Post now</span> to force one immediately.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusFilter === f.id
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        {categories.length > 0 ? (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={fieldClass("select", "small", "ml-auto w-auto")}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">No posts in this view</p>
          <p className="mt-1 text-xs text-slate-500">
            Schedule something from Compose, or clear filters.
          </p>
        </div>
      ) : (
        <ul className={cardClass("plain", "divide-y divide-slate-100 overflow-hidden")}>
          {filtered.map((item) => {
            const mediaItem = item.media.find((m) => m.signedUrl);
            const thumb = mediaItem?.signedUrl;
            const isVideo = (mediaItem?.mime || "").toLowerCase() === "video/mp4";
            const overdue = isOverdue(item);
            return (
              <li key={item.id} className="flex gap-3 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                  {thumb && isVideo ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={thumb} className="h-full w-full object-cover" muted playsInline />
                  ) : thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-caption font-semibold uppercase text-slate-400">
                      {postTypeLabel(item.post_type)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={badgeClass(statusBadgeTone(item.status))}
                    >
                      {statusLabel(item.status)}
                    </span>
                    {overdue ? (
                      <span className={badgeClass("red")}>
                        Overdue
                      </span>
                    ) : null}
                    {item.category ? (
                      <span className={badgeClass("grey")}>
                        {item.category}
                      </span>
                    ) : null}
                    <span className="text-caption font-medium text-slate-400">
                      {postTypeLabel(item.post_type)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-800">{item.content}</p>
                  <p className="mt-1 text-caption text-slate-500">
                    {item.scheduled_for
                      ? formatShortDateTime(item.scheduled_for)
                      : "No schedule"}
                    {item.attempts > 0 ? ` · attempts ${item.attempts}` : ""}
                  </p>
                  {item.last_error ? (
                    <p className="mt-1 line-clamp-2 text-caption text-rose-600">
                      {item.last_error}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => onEdit(item)}
                    className={buttonClass("second", "small")}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  {item.status === "scheduled" || item.status === "failed" ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void publishNow(item)}
                      className={buttonClass("main", "small")}
                    >
                      {busyId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Post now
                    </button>
                  ) : null}
                  {item.status === "scheduled" ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void patch(item.id, "cancel")}
                      className={buttonClass("second", "small")}
                    >
                      <XCircle className="h-3 w-3" />
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void patch(item.id, "clone")}
                    className={buttonClass("second", "small")}
                  >
                    <Copy className="h-3 w-3" />
                    Reuse
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void deleteItem(item)}
                    className={buttonClass("delete", "small")}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
