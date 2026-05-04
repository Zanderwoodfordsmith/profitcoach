"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { DateTime } from "luxon";

import { supabaseClient } from "@/lib/supabaseClient";
import { uploadCommunityPostImage } from "@/lib/communityPostImage";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import type {
  RecurrencePayload,
  WeekdayMon0Sun6,
} from "@/lib/communityCalendarTypes";
import {
  COMMUNITY_CALENDAR_TIMEZONES,
  defaultCommunityCalendarTimezone,
} from "@/lib/communityCalendarTimezones";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 4000;
const DURATIONS_MIN = [15, 30, 45, 60, 90, 120] as const;

const WEEKDAY_LABELS: readonly { id: WeekdayMon0Sun6; label: string }[] = [
  { id: 0, label: "Mon" },
  { id: 1, label: "Tue" },
  { id: 2, label: "Wed" },
  { id: 3, label: "Thu" },
  { id: 4, label: "Fri" },
  { id: 5, label: "Sat" },
  { id: 6, label: "Sun" },
];

type Props = {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

function luxonToMon0Sun6(weekday: number): number {
  return (weekday + 6) % 7;
}

export function AddCommunityEventModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateStr, setDateStr] = useState(() =>
    DateTime.now().toISODate() ?? ""
  );
  const [timeStr, setTimeStr] = useState("17:00");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [timezone, setTimezone] = useState(defaultCommunityCalendarTimezone);
  const [locationKind, setLocationKind] = useState<"link" | "in_person">(
    "link"
  );
  const [locationUrl, setLocationUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [recurring, setRecurring] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatUnit, setRepeatUnit] = useState<"week" | "month">("week");
  const [repeatWeekdays, setRepeatWeekdays] = useState<WeekdayMon0Sun6[]>([]);
  const [endMode, setEndMode] = useState<"never" | "on" | "after">("never");
  const [endDateStr, setEndDateStr] = useState(() =>
    DateTime.now().toISODate() ?? ""
  );
  const [endAfterCount, setEndAfterCount] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverPreview = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : null),
    [coverFile]
  );

  useEffect(() => {
    if (!coverPreview) return;
    return () => URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  useEffect(() => {
    if (!recurring || !dateStr) return;
    const dt = DateTime.fromISO(dateStr, { zone: timezone });
    if (!dt.isValid) return;
    const wd = luxonToMon0Sun6(dt.weekday) as WeekdayMon0Sun6;
    setRepeatWeekdays((prev) => (prev.length === 0 ? [wd] : prev));
  }, [recurring, dateStr, timezone]);

  const toggleWeekday = (id: WeekdayMon0Sun6) => {
    setRepeatWeekdays((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id].sort((a, b) => a - b)
    );
  };

  const recurrencePayload = useCallback((): RecurrencePayload | null => {
    if (!recurring) return null;
    const payload: RecurrencePayload = {
      interval: Math.max(1, Math.floor(repeatInterval)),
      unit: repeatUnit,
      weekdays: repeatUnit === "week" ? [...repeatWeekdays] : [],
      end: endMode,
    };
    if (endMode === "on") payload.endDate = endDateStr;
    if (endMode === "after") payload.maxOccurrences = Math.max(1, endAfterCount);
    return payload;
  }, [
    recurring,
    repeatInterval,
    repeatUnit,
    repeatWeekdays,
    endMode,
    endDateStr,
    endAfterCount,
  ]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !dateStr || !timeStr || saving) return false;
    if (locationKind === "link") {
      const u = locationUrl.trim();
      if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
    }
    if (recurring) {
      if (repeatUnit === "week" && repeatWeekdays.length === 0) return false;
    }
    return true;
  }, [
    title,
    dateStr,
    timeStr,
    saving,
    locationKind,
    locationUrl,
    recurring,
    repeatUnit,
    repeatWeekdays.length,
  ]);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    let coverUrl: string | null = null;
    if (coverFile) {
      const up = await uploadCommunityPostImage(
        coverFile,
        session.access_token
      );
      if ("error" in up) {
        setError(up.error);
        setSaving(false);
        return;
      }
      coverUrl = up.image_url;
    }

    const [hh, mm] = timeStr.split(":").map((x) => Number(x));
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      setError("Invalid time.");
      setSaving(false);
      return;
    }

    const startLocal = DateTime.fromObject(
      {
        ...(() => {
          const [y, mo, d] = dateStr.split("-").map((n) => Number(n));
          return { year: y, month: mo, day: d, hour: hh, minute: mm };
        })(),
      },
      { zone: timezone }
    );

    if (!startLocal.isValid) {
      setError("Invalid date or time for this timezone.");
      setSaving(false);
      return;
    }

    const startUtc = startLocal.toUTC();
    const endUtc = startUtc.plus({ minutes: durationMin });

    const rec = recurrencePayload();
    if (recurring && rec?.unit === "week") {
      const wd = luxonToMon0Sun6(startLocal.weekday) as WeekdayMon0Sun6;
      if (!rec.weekdays.includes(wd)) {
        setError("Include the event’s weekday in “Repeat on”, or change the date.");
        setSaving(false);
        return;
      }
    }

    const { error: insErr } = await supabaseClient
      .from("community_calendar_events")
      .insert({
        created_by: session.user.id,
        title: title.trim().slice(0, TITLE_MAX),
        description: description.trim().slice(0, DESCRIPTION_MAX),
        cover_image_url: coverUrl,
        starts_at: startUtc.toISO(),
        ends_at: endUtc.toISO(),
        display_timezone: timezone,
        location_kind: locationKind,
        location_url: locationKind === "link" ? locationUrl.trim() : null,
        is_recurring: Boolean(recurring && rec),
        recurrence: recurring && rec ? rec : null,
      });

    if (insErr) {
      const msg = supabaseErrorMessage(insErr);
      const hint = communityAccessHint(msg);
      setError(hint ? `${msg}\n\n${hint}` : msg);
      setSaving(false);
      return;
    }

    await onCreated();
    setSaving(false);
  }, [
    canSubmit,
    coverFile,
    dateStr,
    description,
    durationMin,
    locationKind,
    locationUrl,
    recurrencePayload,
    recurring,
    timeStr,
    timezone,
    title,
    onCreated,
  ]);

  const tzOptions = useMemo(() => {
    const s = new Set(COMMUNITY_CALENDAR_TIMEZONES);
    if (!s.has(timezone)) {
      return [timezone, ...COMMUNITY_CALENDAR_TIMEZONES];
    }
    return [...COMMUNITY_CALENDAR_TIMEZONES];
  }, [timezone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-title"
    >
      <div
        className="max-h-[min(92vh,900px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="add-event-title"
          className="text-xl font-bold text-slate-900"
        >
          Add event
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Need ideas? Try{" "}
          <span className="text-sky-600">coffee hour</span>,{" "}
          <span className="text-sky-600">Q&amp;A</span>, or{" "}
          <span className="text-sky-600">co-working session</span>.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <p className="mt-0.5 text-right text-xs text-slate-400">
              {title.length} / {TITLE_MAX}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Date
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Time
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Duration
              </label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                {DURATIONS_MIN.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                {tzOptions.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Recurring event
          </label>

          {recurring ? (
            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">Repeat every</span>
                <select
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <select
                  value={repeatUnit}
                  onChange={(e) =>
                    setRepeatUnit(e.target.value as "week" | "month")
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>

              {repeatUnit === "week" ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    Repeat on
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_LABELS.map(({ id, label }) => (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={repeatWeekdays.includes(id)}
                          onChange={() => toggleWeekday(id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">End</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      name="endMode"
                      checked={endMode === "never"}
                      onChange={() => setEndMode("never")}
                      className="text-sky-600"
                    />
                    Never
                  </label>
                  <label className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      name="endMode"
                      checked={endMode === "on"}
                      onChange={() => setEndMode("on")}
                      className="text-sky-600"
                    />
                    On
                    <input
                      type="date"
                      value={endDateStr}
                      onChange={(e) => setEndDateStr(e.target.value)}
                      disabled={endMode !== "on"}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                    />
                  </label>
                  <label className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      name="endMode"
                      checked={endMode === "after"}
                      onChange={() => setEndMode("after")}
                      className="text-sky-600"
                    />
                    After
                    <input
                      type="number"
                      min={1}
                      value={endAfterCount}
                      onChange={(e) =>
                        setEndAfterCount(Number(e.target.value) || 1)
                      }
                      disabled={endMode !== "after"}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                    />
                    occurrences
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Location
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={locationKind}
                onChange={(e) =>
                  setLocationKind(e.target.value as "link" | "in_person")
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 sm:max-w-[11rem]"
              >
                <option value="link">Custom link</option>
                <option value="in_person">In person</option>
              </select>
              {locationKind === "link" ? (
                <input
                  type="url"
                  placeholder="https://…"
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  className="w-full flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              ) : (
                <p className="text-sm text-slate-500">
                  Shown as &ldquo;In person&rdquo; on the calendar.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              placeholder="Description"
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <p className="mt-0.5 text-right text-xs text-slate-400">
              {description.length} / {DESCRIPTION_MAX}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">
              Cover image
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-slate-400">
              <ImagePlus className="h-6 w-6 text-sky-600" strokeWidth={1.75} />
              <span className="mt-2 text-sm font-medium text-sky-600">
                Upload cover image
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Recommended wide image (e.g. 1460×752)
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  setCoverFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
            {coverPreview ? (
              <div className="relative mt-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverPreview}
                  alt=""
                  className="max-h-40 rounded-lg object-cover ring-1 ring-slate-200"
                />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
                  aria-label="Remove cover"
                  onClick={() => setCoverFile(null)}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <pre className="mt-4 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-900 ring-1 ring-rose-100">
            {error}
          </pre>
        ) : null}

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
