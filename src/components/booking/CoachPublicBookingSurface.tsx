"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarEmbed } from "@/components/CalendarEmbed";
import {
  NativeBookingEmbed,
  type NativeBookingContact,
} from "@/components/booking/NativeBookingEmbed";
import { PublicBookClient } from "@/components/booking/PublicBookClient";
import type { CalendarContactParams } from "@/lib/calendarContactParams";
import type { BookingCalendarProvider } from "@/lib/booking/coachBookingProvider";

export type PublicCalendarApiResponse = {
  provider?: BookingCalendarProvider;
  calendar_embed_code?: string | null;
  coach_slug?: string | null;
  calendar_slug?: string | null;
  error?: string;
};

type Props = {
  coachSlug: string;
  /** Prefill for native / GHL when known (assessments). */
  contact?: CalendarContactParams | null;
  /** Fallback GHL embed while loading or for previews. */
  fallbackEmbedCode?: string | null;
  /** Compact native embed (assessment thank-you). */
  embedded?: boolean;
  className?: string;
};

function toNativeContact(
  contact?: CalendarContactParams | null
): NativeBookingContact | null {
  const email = contact?.email?.trim() ?? "";
  if (!email) return null;
  return {
    firstName: contact?.firstName?.trim() || "Guest",
    lastName: contact?.lastName?.trim() || "",
    email,
    phone: contact?.phone?.trim() || undefined,
  };
}

/**
 * Renders the coach's public booking UI based on booking_calendar_provider.
 */
export function CoachPublicBookingSurface({
  coachSlug,
  contact,
  fallbackEmbedCode = null,
  embedded = true,
  className,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [surface, setSurface] = useState<PublicCalendarApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!coachSlug.trim()) {
      setSurface(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/coaches/${encodeURIComponent(coachSlug)}/calendar`
      );
      const data = (await res.json().catch(() => null)) as PublicCalendarApiResponse | null;
      setSurface(res.ok && data ? data : null);
    } catch {
      setSurface(null);
    } finally {
      setLoading(false);
    }
  }, [coachSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const provider = surface?.provider ?? "ghl";
  const embed =
    surface?.calendar_embed_code?.trim() || fallbackEmbedCode?.trim() || null;
  const nativeSlug = surface?.coach_slug?.trim() || coachSlug.trim();
  const calendarSlug = surface?.calendar_slug?.trim() || "discovery";
  const nativeContact = toNativeContact(contact);

  if (provider === "native" && nativeSlug) {
    if (nativeContact) {
      return (
        <div className={className}>
          <NativeBookingEmbed
            slug={nativeSlug}
            calendarSlug={calendarSlug}
            contact={nativeContact}
            embedded={embedded}
          />
        </div>
      );
    }
    return (
      <div className={className}>
        <PublicBookClient slug={nativeSlug} />
      </div>
    );
  }

  if (embed) {
    return (
      <div className={className}>
        <CalendarEmbed embedCode={embed} contact={contact} />
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"
      }
    >
      <p className="text-sm font-semibold text-slate-700">
        {loading ? "Loading calendar…" : "Calendar unavailable"}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {loading
          ? "Hang tight while we load booking times."
          : "Your coach can finish calendar setup in Settings → Calendar."}
      </p>
    </div>
  );
}
