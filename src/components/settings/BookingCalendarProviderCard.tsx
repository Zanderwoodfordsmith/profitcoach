"use client";

import { useCallback, useEffect, useState } from "react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { BookingCalendarProvider } from "@/lib/booking/coachBookingProvider";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  /** Called after a successful provider save so parent can refresh. */
  onProviderChange?: (provider: BookingCalendarProvider) => void;
  /** When true, Google is connected (soft nudge only). */
  googleConnected?: boolean | null;
};

/**
 * Flip switch between Profit Coach native calendars and CRM (GHL) embed.
 */
export function BookingCalendarProviderCard({
  onProviderChange,
  googleConnected = null,
}: Props) {
  const { impersonatingCoachId } = useImpersonation();
  const [provider, setProvider] = useState<BookingCalendarProvider>("ghl");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [impersonatingCoachId]);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/coach/profile", { headers });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      booking_calendar_provider?: string | null;
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load calendar provider.");
      setLoading(false);
      return;
    }
    setProvider(
      body.booking_calendar_provider === "native" ? "native" : "ghl"
    );
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setAndSave(next: BookingCalendarProvider) {
    if (next === provider || saving) return;
    setError(null);
    setSavedFlash(false);
    setSaving(true);
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }
    const previous = provider;
    setProvider(next);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ booking_calendar_provider: next }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setProvider(previous);
      setError(body.error ?? "Could not save.");
      return;
    }
    setSavedFlash(true);
    onProviderChange?.(next);
    window.setTimeout(() => setSavedFlash(false), 2500);
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200/80 bg-white p-4">
        <p className="text-sm text-slate-600">Loading booking provider…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">
        Booking calendar provider
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose which calendar prospects see after Boss Score / Boss Pro and on
        your public booking links.
      </p>

      <div
        className="mt-4 grid gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Booking calendar provider"
      >
        <button
          type="button"
          role="radio"
          aria-checked={provider === "native"}
          disabled={saving}
          onClick={() => void setAndSave("native")}
          className={[
            "rounded-lg border px-3 py-3 text-left transition",
            provider === "native"
              ? "border-sky-600 bg-sky-50 ring-1 ring-sky-600"
              : "border-slate-200 bg-white hover:border-slate-300",
          ].join(" ")}
        >
          <span className="block text-sm font-semibold text-slate-900">
            Profit Coach calendars
          </span>
          <span className="mt-1 block text-xs text-slate-600">
            Native booking with your availability and Google Calendar.
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={provider === "ghl"}
          disabled={saving}
          onClick={() => void setAndSave("ghl")}
          className={[
            "rounded-lg border px-3 py-3 text-left transition",
            provider === "ghl"
              ? "border-sky-600 bg-sky-50 ring-1 ring-sky-600"
              : "border-slate-200 bg-white hover:border-slate-300",
          ].join(" ")}
        >
          <span className="block text-sm font-semibold text-slate-900">
            CRM calendar
          </span>
          <span className="mt-1 block text-xs text-slate-600">
            Keep your Pro Coach Platform / GHL embed from Get Clients.
          </span>
        </button>
      </div>

      {provider === "native" && googleConnected === false ? (
        <p className="mt-3 text-sm text-amber-800">
          Connect Google below for Meet links and busy-time blocking. Bookings
          still work without it.
        </p>
      ) : null}

      {provider === "ghl" ? (
        <p className="mt-3 text-sm text-slate-600">
          Manage your CRM embed and location ID under{" "}
          <span className="font-medium text-slate-800">Settings → Get Clients</span>
          .
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {savedFlash ? (
        <p className="mt-3 text-sm text-emerald-700">Saved.</p>
      ) : null}
      {saving ? (
        <p className="mt-3 text-sm text-slate-500">Saving…</p>
      ) : null}
    </section>
  );
}
