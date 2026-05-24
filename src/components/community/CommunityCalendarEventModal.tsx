"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Ellipsis,
  Link as LinkIcon,
  MapPin,
  Video,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { DateTime } from "luxon";

import { supabaseClient } from "@/lib/supabaseClient";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import type { CommunityCalendarOccurrence } from "@/lib/communityCalendarTypes";
import { CommunityCalendarCoverImage } from "@/components/community/CommunityCalendarCoverImage";
import {
  communityCalendarCancelledBadgeClass,
  communityCalendarCoverUrl,
} from "@/lib/communityCalendarDisplay";
import { inferCommunityPostMediaKindFromUrl } from "@/lib/communityPostMedia";
import { updateCommunityCalendarCancellationReason } from "@/lib/communityCalendarData";

type Props = {
  occurrence: CommunityCalendarOccurrence;
  onClose: () => void;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  onRecordingSaved?: () => void;
  onCancellationReasonSaved?: () => void;
};

function formatEventRange(occurrence: CommunityCalendarOccurrence): string {
  const start = DateTime.fromISO(occurrence.startsAtIso, { zone: "utc" }).setZone(
    occurrence.display_timezone || "UTC"
  );
  const end = DateTime.fromISO(occurrence.endsAtIso, { zone: "utc" }).setZone(
    occurrence.display_timezone || "UTC"
  );
  const datePart = start.toFormat("cccc");
  const sameDay = start.toISODate() === end.toISODate();
  if (sameDay) {
    return `${datePart} @ ${start.toFormat("h:mm a")} - ${end.toFormat("h:mm a")}`;
  }
  return `${start.toFormat("ccc h:mm a")} - ${end.toFormat("ccc h:mm a")}`;
}

function maybeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    return null;
  }
}

function recordingWatchUrl(occurrence: CommunityCalendarOccurrence): string | null {
  const video = occurrence.recording_video_url?.trim();
  if (video && /^https?:\/\//i.test(video)) return video;
  const link = occurrence.recording_link_url?.trim();
  if (link && /^https?:\/\//i.test(link)) return link;
  return null;
}

export function CommunityCalendarEventModal({
  occurrence,
  onClose,
  canManage = false,
  onEdit,
  onDelete,
  onRecordingSaved,
  onCancellationReasonSaved,
}: Props) {
  const whenLabel = useMemo(() => formatEventRange(occurrence), [occurrence]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recordingLinkDraft, setRecordingLinkDraft] = useState(
    occurrence.recording_link_url ?? ""
  );
  const [cancellationReasonDraft, setCancellationReasonDraft] = useState(
    occurrence.cancellationReason ?? ""
  );
  const [recordingSaving, setRecordingSaving] = useState(false);
  const [cancellationReasonSaving, setCancellationReasonSaving] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [cancellationReasonError, setCancellationReasonError] = useState<
    string | null
  >(null);

  useEffect(() => {
    setRecordingLinkDraft(occurrence.recording_link_url ?? "");
    setRecordingError(null);
  }, [occurrence]);

  useEffect(() => {
    setCancellationReasonDraft(occurrence.cancellationReason ?? "");
    setCancellationReasonError(null);
  }, [occurrence]);

  const isPast = useMemo(() => {
    const endUtc = DateTime.fromISO(occurrence.endsAtIso, { zone: "utc" });
    return endUtc.isValid && endUtc <= DateTime.now().toUTC();
  }, [occurrence.endsAtIso]);

  const watchUrl = useMemo(() => recordingWatchUrl(occurrence), [occurrence]);
  const coverUrl = useMemo(() => communityCalendarCoverUrl(occurrence), [occurrence]);

  const saveRecordingLink = useCallback(async () => {
    const trimmed = recordingLinkDraft.trim();
    if (trimmed) {
      const u = maybeUrl(trimmed);
      if (!u) {
        setRecordingError("Enter a valid http:// or https:// URL.");
        return;
      }
    }
    setRecordingSaving(true);
    setRecordingError(null);
    try {
      const { error } = await supabaseClient
        .from("community_calendar_events")
        .update({
          recording_link_url: trimmed || null,
        })
        .eq("id", occurrence.eventId);
      if (error) throw error;
      onRecordingSaved?.();
    } catch (e) {
      const msg = supabaseErrorMessage(e);
      const hint = communityAccessHint(msg);
      setRecordingError(
        [msg, hint ?? ""].filter(Boolean).join("\n\n") ||
          "Could not save recording link."
      );
    } finally {
      setRecordingSaving(false);
    }
  }, [recordingLinkDraft, occurrence.eventId, onRecordingSaved]);

  const saveCancellationReason = useCallback(async () => {
    setCancellationReasonSaving(true);
    setCancellationReasonError(null);
    try {
      await updateCommunityCalendarCancellationReason(
        occurrence.eventId,
        occurrence.startsAtIso,
        cancellationReasonDraft.trim() || null
      );
      onCancellationReasonSaved?.();
    } catch (e) {
      const msg = supabaseErrorMessage(e);
      const hint = communityAccessHint(msg);
      setCancellationReasonError(
        [msg, hint ?? ""].filter(Boolean).join("\n\n") ||
          "Could not save cancellation reason."
      );
    } finally {
      setCancellationReasonSaving(false);
    }
  }, [
    cancellationReasonDraft,
    occurrence.eventId,
    occurrence.startsAtIso,
    onCancellationReasonSaved,
  ]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/55 p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close event card"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <article className="relative z-[121] flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {canManage && !occurrence.isCancelled ? (
          <div className="absolute right-12 top-3 z-20">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Event options"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-full bg-white/90 p-1 text-slate-600 shadow-sm hover:text-slate-900"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-1 min-w-[9rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit?.();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void onDelete?.();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Cancel session
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 rounded-full bg-white/90 p-1 text-slate-600 shadow-sm hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
        <CommunityCalendarCoverImage occurrence={occurrence} variant="hero" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3 p-5">
          {occurrence.isCancelled ? (
            <p className={communityCalendarCancelledBadgeClass()}>Cancelled</p>
          ) : null}
          <h2
            className={`text-2xl font-bold leading-tight ${
              occurrence.isCancelled
                ? "text-rose-600 line-through"
                : "text-slate-900"
            }`}
          >
            {occurrence.title}
          </h2>
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>{whenLabel}</span>
          </p>
          {occurrence.isCancelled ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <p>This session has been cancelled and will not take place.</p>
              {occurrence.cancellationReason?.trim() ? (
                <p className="mt-2 font-medium text-rose-900">
                  {occurrence.cancellationReason.trim()}
                </p>
              ) : null}
            </div>
          ) : null}
          {occurrence.isCancelled && canManage ? (
            <div className="space-y-2 border-t border-rose-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cancellation reason
              </p>
              <textarea
                value={cancellationReasonDraft}
                onChange={(e) => setCancellationReasonDraft(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Why was this session cancelled?"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              {cancellationReasonError ? (
                <p className="text-xs text-rose-700">{cancellationReasonError}</p>
              ) : null}
              <button
                type="button"
                disabled={cancellationReasonSaving}
                onClick={() => void saveCancellationReason()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {cancellationReasonSaving ? "Saving…" : "Save reason"}
              </button>
            </div>
          ) : null}
          {occurrence.location_kind === "link" && occurrence.location_url ? (
            <p className="flex items-start gap-2 text-sm">
              <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <a
                href={occurrence.location_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-blue-600 hover:underline"
              >
                {occurrence.location_url}
              </a>
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span>In person</span>
            </p>
          )}
          {occurrence.description?.trim() ? (
            <div className="space-y-2 border-t border-slate-100 pt-2">
              {occurrence.description
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .filter((line) => {
                  const url = maybeUrl(line);
                  if (!url) return true;
                  if (coverUrl && url === coverUrl) return false;
                  return inferCommunityPostMediaKindFromUrl(url) !== "image";
                })
                .map((line, idx) => {
                  const url = maybeUrl(line);
                  if (url) {
                    return (
                      <p key={`${line}-${idx}`} className="text-sm">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-blue-600 hover:underline"
                        >
                          {line}
                        </a>
                      </p>
                    );
                  }
                  return (
                    <p key={`${line}-${idx}`} className="text-sm text-slate-700">
                      {line}
                    </p>
                  );
                })}
            </div>
          ) : null}
          {isPast && watchUrl && !occurrence.isCancelled ? (
            <div className="border-t border-slate-100 pt-3">
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Video className="h-4 w-4" />
                Watch recording
              </a>
            </div>
          ) : null}
          {isPast && canManage && !occurrence.isCancelled ? (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recording link
              </p>
              <input
                type="url"
                value={recordingLinkDraft}
                onChange={(e) => setRecordingLinkDraft(e.target.value)}
                placeholder="https://zoom.us/rec/..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              {recordingError ? (
                <p className="text-xs text-rose-700">{recordingError}</p>
              ) : null}
              <button
                type="button"
                disabled={recordingSaving}
                onClick={() => void saveRecordingLink()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {recordingSaving ? "Saving…" : "Save recording link"}
              </button>
              <p className="text-xs text-slate-500">
                Applies to this event (including all dates in a recurring series).
                Upload a video file via Edit if needed.
              </p>
            </div>
          ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
