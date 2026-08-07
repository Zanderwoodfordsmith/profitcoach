"use client";

import { useId } from "react";
import Script from "next/script";
import {
  BCA_DISCOVERY_BOOKING_BASE,
  BCA_DISCOVERY_EMBED_SCRIPT,
} from "@/lib/bcaDiscoveryCalendar";
import type { CalendarContactParams } from "@/lib/calendarContactParams";

export type BookingPrefill = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export type BookingCalendarProps = {
  /** Defaults to the BCA discovery / 15-Minute Fit Call calendar. */
  bookingBase?: string;
  prefill?: BookingPrefill | CalendarContactParams | null;
  /** Shown in the chrome above the embed. */
  title?: string;
  durationLabel?: string;
  iframeTitle?: string;
  className?: string;
  /** Soft blue thanks band; omit for a simpler shell. */
  showThanks?: boolean;
};

function buildBookingSrc(
  bookingBase: string,
  prefill: BookingPrefill | CalendarContactParams | null | undefined
) {
  const first = prefill?.firstName?.trim() ?? "";
  const last = prefill?.lastName?.trim() ?? "";
  const email = prefill?.email?.trim() ?? "";
  const phone = prefill?.phone?.trim() ?? "";
  const params = new URLSearchParams();
  if (first) params.set("first_name", first);
  if (last) params.set("last_name", last);
  if (first || last) params.set("name", `${first} ${last}`.trim());
  if (email) params.set("email", email);
  if (phone) params.set("phone", phone);
  const qs = params.toString();
  return qs ? `${bookingBase}?${qs}` : bookingBase;
}

/**
 * High Level booking calendar with BCA-style chrome (thanks band + title + duration).
 * Ported from bca-website `BookingCalendar` — no phone/email gate.
 */
export function BookingCalendar({
  bookingBase = BCA_DISCOVERY_BOOKING_BASE,
  prefill,
  title = "15-Minute Fit Call",
  durationLabel = "15 minutes",
  iframeTitle = "Book a 15-Minute Fit Call",
  className = "",
  showThanks = true,
}: BookingCalendarProps) {
  const uid = useId().replace(/:/g, "");
  const first = prefill?.firstName?.trim() ?? "";
  const src = buildBookingSrc(bookingBase, prefill);
  const iframeId = `bca-booking-${uid}`;

  return (
    <div
      className={[
        "relative z-10 w-full max-w-[532px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mx-auto w-full max-w-[532px] overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(6,26,46,0.28)]">
        <div className="flex flex-col items-center bg-white p-0 text-center">
          {showThanks ? (
            <p className="m-0 box-border w-full bg-[#75c1ff] px-5 py-3.5 text-center text-[clamp(1.05rem,1.6vw,1.15rem)] font-bold leading-snug text-[#0c2438]">
              {first
                ? `Thanks ${first}, pick a time that works`
                : "Pick a time that works"}
            </p>
          ) : null}
          <div className="flex flex-col items-center gap-2 px-[22px] pb-3 pt-4">
            <h3 className="m-0 text-center text-[1.05rem] font-semibold tracking-tight text-[rgba(12,36,56,0.72)]">
              {title}
            </h3>
            <p className="m-0 inline-flex items-center justify-center gap-1.5 text-sm font-medium leading-snug text-[rgba(12,36,56,0.55)]">
              <svg
                className="h-4 w-4 shrink-0 text-[rgba(12,36,56,0.5)]"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 7v5.2l3.2 1.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {durationLabel}
            </p>
          </div>
        </div>
        <div className="box-border bg-white px-[18px] pb-[18px]">
          <iframe
            src={src}
            title={iframeTitle}
            allow="payment"
            style={{
              width: "100%",
              border: "none",
              overflow: "hidden",
              display: "block",
              height: "520px",
              minHeight: 0,
              background: "#fff",
            }}
            scrolling="no"
            id={iframeId}
          />
        </div>
      </div>
      <Script src={BCA_DISCOVERY_EMBED_SCRIPT} strategy="afterInteractive" />
    </div>
  );
}
