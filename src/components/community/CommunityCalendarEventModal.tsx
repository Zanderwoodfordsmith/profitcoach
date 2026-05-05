"use client";

import { useMemo } from "react";
import { CalendarDays, Link as LinkIcon, MapPin, X } from "lucide-react";
import { DateTime } from "luxon";

import type { CommunityCalendarOccurrence } from "@/lib/communityCalendarTypes";

type Props = {
  occurrence: CommunityCalendarOccurrence;
  onClose: () => void;
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

export function CommunityCalendarEventModal({ occurrence, onClose }: Props) {
  const whenLabel = useMemo(() => formatEventRange(occurrence), [occurrence]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/55 px-4 py-6">
      <button
        type="button"
        aria-label="Close event card"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <article className="relative z-[121] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full bg-white/90 p-1 text-slate-600 shadow-sm hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative h-44 w-full overflow-hidden bg-slate-100">
          {occurrence.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={occurrence.cover_image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
              Community event
            </div>
          )}
        </div>
        <div className="space-y-3 p-5">
          <h2 className="text-2xl font-bold leading-tight text-slate-900">
            {occurrence.title}
          </h2>
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>{whenLabel}</span>
          </p>
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
        </div>
      </article>
    </div>
  );
}
