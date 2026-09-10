"use client";

import { Suspense, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { CallsCalendarSettings } from "@/components/calls/CallsCalendarSettings";
import { GoogleCalendarBookingCard } from "@/components/booking/GoogleCalendarBookingCard";
import { SupportCallOptionsCard } from "@/components/support/SupportCallOptionsCard";
import {
  SUPPORT_CALL_HOSTS,
  type SupportCallHostSlug,
} from "@/lib/support/supportCallHosts";

type Props = {
  appOrigin: string;
};

/**
 * Compact platform support-call setup (Zander / Pam).
 * Hours + call options + Google — no coach “booking calendars” chrome.
 */
export function SupportCallAdminSettings({ appOrigin }: Props) {
  const [host, setHost] = useState<SupportCallHostSlug>("zander");
  const [copied, setCopied] = useState(false);
  const origin = appOrigin.replace(/\/$/, "");
  const activeHost =
    SUPPORT_CALL_HOSTS.find((h) => h.slug === host) ?? SUPPORT_CALL_HOSTS[0];
  const publicUrl = `${origin}${activeHost.path}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          {SUPPORT_CALL_HOSTS.map((h) => (
            <button
              key={h.slug}
              type="button"
              onClick={() => setHost(h.slug)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                host === h.slug
                  ? "bg-sky-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {h.displayName}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
          >
            {activeHost.path}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Set when {activeHost.displayName} is available and how far ahead people
        can book. Google Calendar is for busy times and invites; join link is{" "}
        <a
          className="font-medium text-sky-700 hover:underline"
          href={`https://theprofitcoach.com/zoom-${host}`}
          target="_blank"
          rel="noreferrer"
        >
          theprofitcoach.com/zoom-{host}
        </a>
        .
      </p>

      <SupportCallOptionsCard key={`opts-${host}`} forSlug={host} />

      <CallsCalendarSettings
        key={`hours-${host}`}
        appOrigin={appOrigin}
        callsBasePath="/admin/calls"
        forSlug={host}
        hideCalendars
        hoursTitle="Weekly hours"
        hoursHint="When this host can take support calls"
      />

      <Suspense
        fallback={
          <p className="text-sm text-slate-600">Loading Google Calendar…</p>
        }
      >
        <GoogleCalendarBookingCard
          key={`gcal-${host}`}
          forSlug={host}
          returnTo="/admin/support?tab=settings"
          compact
        />
      </Suspense>
    </div>
  );
}
