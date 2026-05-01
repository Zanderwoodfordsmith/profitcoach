"use client";

import { useMemo, useState } from "react";
import { inclusiveDays } from "@/lib/connectionVolume";

const LOW_CR_SAMPLE = 300;

export function ConnectionVolumePanel({
  connectionRequests,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  connectionRequests: number;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}) {
  const [ssi70Plus, setSsi70Plus] = useState(false);
  const [ssiScore, setSsiScore] = useState("");

  const days = useMemo(
    () => inclusiveDays(startDate, endDate),
    [startDate, endDate],
  );

  const rangeBad = Boolean(startDate && endDate && days === null);
  const lowSample =
    connectionRequests > 0 &&
    connectionRequests < LOW_CR_SAMPLE &&
    days !== null &&
    !rangeBad;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        {/* Campaign dates */}
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-700">
            Campaign Date
          </h3>

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold text-zinc-800">
                Beginning
              </span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="h-9 w-full max-w-[11.5rem] cursor-pointer rounded-md border border-zinc-200 bg-zinc-50/80 px-2.5 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200/80 sm:max-w-none"
              />
            </div>

            <div className="hidden text-zinc-300 sm:block sm:self-end sm:px-0.5">
              <span className="text-lg font-light" aria-hidden>
                →
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold text-zinc-800">End</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="h-9 w-full max-w-[11.5rem] cursor-pointer rounded-md border border-zinc-200 bg-zinc-50/80 px-2.5 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200/80 sm:max-w-none"
              />
            </div>
          </div>

          {rangeBad ? (
            <p className="text-[11px] text-rose-600">End before start.</p>
          ) : null}

          {days !== null && !rangeBad ? (
            <p className="text-[12px] text-zinc-600">
              <span className="font-medium text-zinc-800">{days}</span>
              {days === 1 ? " day" : " days"} in this window
            </p>
          ) : null}

          {lowSample ? (
            <p className="text-[11px] text-amber-800/90">
              &lt;{LOW_CR_SAMPLE} CRs — rates are noisy.
            </p>
          ) : null}
        </div>

        <div
          className="hidden h-full w-px shrink-0 bg-zinc-200 sm:block"
          aria-hidden
        />

        <div className="h-px w-full bg-zinc-200 sm:hidden" aria-hidden />

        {/* SSI */}
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:min-w-[12rem]">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-700">
            Social Selling Index
          </h3>
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
              <input
                type="checkbox"
                checked={ssi70Plus}
                onChange={(e) => {
                  setSsi70Plus(e.target.checked);
                  if (e.target.checked) setSsiScore("");
                }}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              <span>SSI is 70 or above</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-zinc-800">
                Score (0–100)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                placeholder="—"
                value={ssiScore}
                disabled={ssi70Plus}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                  setSsiScore(v);
                  if (v) setSsi70Plus(false);
                }}
                onBlur={() => {
                  if (ssiScore === "") return;
                  const n = Number.parseInt(ssiScore, 10);
                  if (!Number.isFinite(n)) setSsiScore("");
                  else if (n > 100) setSsiScore("100");
                }}
                className="h-9 w-full max-w-[8rem] rounded-md border border-zinc-200 bg-white px-2.5 text-center text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200/80 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
