"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { LI_BLUE, postTypeLabel, type LinkedInPostItem } from "./types";

type Props = {
  items: LinkedInPostItem[];
  getToken: () => Promise<string>;
  onMessage: (message: string, tone: "success" | "error" | "neutral") => void;
  onRefresh: () => Promise<void>;
  onUseInComposer: (item: LinkedInPostItem) => void;
};

export function LinkedInLibraryTab({
  items,
  getToken,
  onMessage,
  onRefresh,
  onUseInComposer,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleForId, setScheduleForId] = useState<string | null>(null);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");

  const drafts = useMemo(
    () => items.filter((i) => i.status === "draft"),
    [items]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, LinkedInPostItem[]>();
    for (const d of drafts) {
      const key = d.category?.trim() || "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [drafts]);

  async function deleteDraft(id: string) {
    setBusyId(id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/linkedin/scheduled/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Delete failed.");
      onMessage("Draft deleted.", "success");
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Delete failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function postNow(item: LinkedInPostItem) {
    setBusyId(item.id);
    try {
      const token = await getToken();
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
      if (!res.ok || !body.ok) throw new Error(body.error || "Could not publish.");
      onMessage("Posted to LinkedIn.", "success");
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not publish.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmSchedule(item: LinkedInPostItem) {
    if (!scheduledAtLocal) {
      onMessage("Pick a date and time.", "error");
      return;
    }
    setBusyId(item.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/linkedin/scheduled/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "reschedule",
          scheduled_for: new Date(scheduledAtLocal).toISOString(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Could not schedule.");
      onMessage("Draft scheduled.", "success");
      setScheduleForId(null);
      setScheduledAtLocal("");
      await onRefresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not schedule.", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!drafts.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-700">Library is empty</p>
        <p className="mt-1 text-xs text-slate-500">
          Save drafts from Compose to reuse and repost later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([category, posts]) => (
        <section key={category}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {category}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {posts.map((item) => {
              const mediaItem = item.media.find((m) => m.signedUrl);
              const thumb = mediaItem?.signedUrl;
              const isVideo = (mediaItem?.mime || "").toLowerCase() === "video/mp4";
              return (
                <li
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  {thumb && isVideo ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      src={thumb}
                      className="h-32 w-full object-cover"
                      muted
                      playsInline
                      controls
                    />
                  ) : thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-32 w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <span>{postTypeLabel(item.post_type)}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-800">
                      {item.content}
                    </p>
                    {scheduleForId === item.id ? (
                      <div className="mt-3 space-y-2 rounded-lg border border-sky-100 bg-sky-50/50 p-2">
                        <input
                          type="datetime-local"
                          value={scheduledAtLocal}
                          onChange={(e) => setScheduledAtLocal(e.target.value)}
                          className="w-full rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void confirmSchedule(item)}
                            className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
                            style={{ backgroundColor: LI_BLUE }}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setScheduleForId(null);
                              setScheduledAtLocal("");
                            }}
                            className="text-[11px] font-semibold text-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => onUseInComposer(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => {
                            setScheduleForId(item.id);
                            setScheduledAtLocal("");
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <CalendarClock className="h-3 w-3" />
                          Schedule
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void postNow(item)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: LI_BLUE }}
                        >
                          {busyId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Post
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void deleteDraft(item.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
