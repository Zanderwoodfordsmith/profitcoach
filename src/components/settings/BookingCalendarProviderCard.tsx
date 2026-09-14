"use client";

import { useCallback, useEffect, useState } from "react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { BookingCalendarProvider } from "@/lib/booking/coachBookingProvider";
import {
  normalizeCrmLocationId,
  validateCrmLocationId,
} from "@/lib/ghlCalendarSync";
import { supabaseClient } from "@/lib/supabaseClient";

const CRM_APP_BASE_URL = "https://app.procoachplatform.com/";
const CRM_LOCATION_BASE_URL = "https://app.procoachplatform.com/v2/location";

type Props = {
  /** Called after a successful provider save so parent can refresh. */
  onProviderChange?: (provider: BookingCalendarProvider) => void;
  /** When true, Google is connected (soft nudge only). */
  googleConnected?: boolean | null;
  /** Compact select for the Calls settings sidebar. */
  compact?: boolean;
};

type CrmDraft = {
  crmProfileName: string;
  crmLocationId: string;
  calendarEmbedCode: string;
  leadWebhookUrl: string;
};

/**
 * Flip switch between Profit Coach native calendars and CRM (GHL) embed.
 * CRM location, embed, and webhook only appear when CRM is selected.
 */
export function BookingCalendarProviderCard({
  onProviderChange,
  googleConnected = null,
  compact = false,
}: Props) {
  const { impersonatingCoachId } = useImpersonation();
  const [provider, setProvider] = useState<BookingCalendarProvider>("ghl");
  const [crm, setCrm] = useState<CrmDraft>({
    crmProfileName: "",
    crmLocationId: "",
    calendarEmbedCode: "",
    leadWebhookUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCrm, setSavingCrm] = useState(false);
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
      crm_profile_name?: string | null;
      crm_location_id?: string | null;
      calendar_embed_code?: string | null;
      lead_webhook_url?: string | null;
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load calendar provider.");
      setLoading(false);
      return;
    }
    setProvider(
      body.booking_calendar_provider === "native" ? "native" : "ghl"
    );
    setCrm({
      crmProfileName: body.crm_profile_name ?? "",
      crmLocationId: body.crm_location_id ?? "",
      calendarEmbedCode: body.calendar_embed_code ?? "",
      leadWebhookUrl: body.lead_webhook_url ?? "",
    });
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

  async function saveCrmDetails() {
    setError(null);
    setSavedFlash(false);
    const locationValidation = validateCrmLocationId(crm.crmLocationId);
    if (!locationValidation.ok) {
      setError(locationValidation.error);
      return;
    }
    const trimmedWebhook = crm.leadWebhookUrl.trim();
    if (trimmedWebhook && !/^https?:\/\//i.test(trimmedWebhook)) {
      setError("Lead webhook URL must start with http:// or https://.");
      return;
    }
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      return;
    }
    setSavingCrm(true);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        crm_profile_name: crm.crmProfileName.trim() || null,
        crm_location_id: locationValidation.value,
        calendar_embed_code: crm.calendarEmbedCode.trim() || null,
        lead_webhook_url: trimmedWebhook || null,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingCrm(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save CRM details.");
      return;
    }
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2500);
  }

  const locationId = normalizeCrmLocationId(crm.crmLocationId);
  const platformHref = locationId
    ? `${CRM_LOCATION_BASE_URL}/${encodeURIComponent(locationId)}`
    : CRM_APP_BASE_URL;

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200/80 bg-white p-4">
        <p className="text-sm text-slate-600">Loading booking provider…</p>
      </section>
    );
  }

  const crmFields = (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <p className="text-sm font-semibold text-slate-900">CRM calendar</p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Prospects book through your Pro Coach Platform embed. Paste the
        location and iframe below.
      </p>
      <p className="text-sm">
        <a
          href={platformHref}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          Open Pro Coach Platform
          <span aria-hidden> →</span>
        </a>
      </p>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">CRM profile name</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={crm.crmProfileName}
          onChange={(e) =>
            setCrm((current) => ({
              ...current,
              crmProfileName: e.target.value,
            }))
          }
          placeholder="AMF Consulting"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">CRM location ID</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={crm.crmLocationId}
          onChange={(e) =>
            setCrm((current) => ({
              ...current,
              crmLocationId: e.target.value,
            }))
          }
          placeholder="BsRxKtV0lVHcvvZ6qHtu"
        />
        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
          Paste the ID or the full location URL.
        </span>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Booking calendar embed</span>
        <textarea
          rows={5}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          value={crm.calendarEmbedCode}
          onChange={(e) =>
            setCrm((current) => ({
              ...current,
              calendarEmbedCode: e.target.value,
            }))
          }
          placeholder='<iframe src="https://..." …></iframe>'
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Lead webhook URL</span>
        <input
          type="url"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={crm.leadWebhookUrl}
          onChange={(e) =>
            setCrm((current) => ({
              ...current,
              leadWebhookUrl: e.target.value,
            }))
          }
          placeholder="https://hooks.example.com/coach-leads"
        />
        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
          We POST when we capture an email and again with the score.
        </span>
      </label>
      <button
        type="button"
        disabled={savingCrm}
        onClick={() => void saveCrmDetails()}
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {savingCrm ? "Saving…" : "Save CRM details"}
      </button>
    </div>
  );

  if (compact) {
    return (
      <section className="rounded-xl border border-slate-200/80 bg-white p-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">
            Calendar provider
          </span>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={provider}
            disabled={saving}
            aria-label="Calendar provider"
            onChange={(e) =>
              void setAndSave(e.target.value as BookingCalendarProvider)
            }
          >
            <option value="native">Profit Coach calendars</option>
            <option value="ghl">CRM calendar</option>
          </select>
        </label>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          {provider === "ghl"
            ? "Prospects see your CRM embed. Fill in the details below."
            : "Prospects book the calendars on the left."}
        </p>
        {provider === "ghl" ? crmFields : null}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        {savedFlash ? (
          <p className="mt-2 text-xs text-emerald-700">Saved.</p>
        ) : null}
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
            Native booking with your availability and calendar.
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
            Use your Pro Coach Platform / GHL booking embed.
          </span>
        </button>
      </div>

      {provider === "native" && googleConnected === false ? (
        <p className="mt-3 text-sm text-amber-800">
          Connect Google or Outlook below for meeting links and busy-time
          blocking. Bookings still work without it.
        </p>
      ) : null}

      {provider === "ghl" ? crmFields : null}

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
