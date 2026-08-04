"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Check, Copy, Download, X } from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type SubscribeUrls = {
  httpsUrl: string;
  webcalUrl: string;
  googleUrl: string;
  outlookUrl: string;
  appleUrl: string;
  downloadUrl: string;
  isLocal: boolean;
  eventCount: number;
};

type CommunityCalendarSubscribeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CommunityCalendarSubscribeModal({
  open,
  onClose,
}: CommunityCalendarSubscribeModalProps) {
  const { impersonatingCoachId } = useImpersonation();
  const [urls, setUrls] = useState<SubscribeUrls | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadUrls = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    setDownloadError(null);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      setError("Sign in to subscribe to the calendar.");
      setUrls(null);
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch("/api/coach/community/calendar/subscribe", {
      headers,
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      httpsUrl?: string;
      webcalUrl?: string;
      googleUrl?: string;
      outlookUrl?: string;
      appleUrl?: string;
      downloadUrl?: string;
      isLocal?: boolean;
      eventCount?: number;
    };

    if (!res.ok || !body.httpsUrl || !body.webcalUrl) {
      setLoading(false);
      setError(body.error || "Could not prepare subscribe link.");
      setUrls(null);
      return;
    }

    setUrls({
      httpsUrl: body.httpsUrl,
      webcalUrl: body.webcalUrl,
      googleUrl: body.googleUrl || body.httpsUrl,
      outlookUrl: body.outlookUrl || body.httpsUrl,
      appleUrl: body.appleUrl || body.webcalUrl,
      downloadUrl:
        body.downloadUrl || "/api/coach/community/calendar/subscribe?download=1",
      isLocal: Boolean(body.isLocal),
      eventCount: typeof body.eventCount === "number" ? body.eventCount : 0,
    });
    setLoading(false);
  }, [impersonatingCoachId]);

  useEffect(() => {
    if (!open) return;
    void loadUrls();
  }, [open, loadUrls]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const copyFeedUrl = async () => {
    if (!urls?.httpsUrl) return;
    try {
      await navigator.clipboard.writeText(urls.httpsUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy calendar feed URL:", urls.httpsUrl);
    }
  };

  const downloadIcs = async () => {
    if (!urls?.downloadUrl) return;
    setDownloadError(null);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setDownloadError("Sign in to download the calendar.");
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch(urls.downloadUrl, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setDownloadError(body.error || "Could not download calendar file.");
      return;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "Profit Coach Calls.ics";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  if (!open) return null;

  const remoteSubscribeDisabled = Boolean(urls?.isLocal);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-calendar-subscribe-title"
        className="flex max-h-[min(92vh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="community-calendar-subscribe-title"
              className="text-base font-semibold text-slate-900"
            >
              Subscribe to calls
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Add your Profit Coach calls to Google, Apple, or Outlook. The feed
              updates when times change.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-600">Preparing your feed…</p>
          ) : error ? (
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : urls ? (
            <div className="space-y-3">
              {remoteSubscribeDisabled ? (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950"
                  role="status"
                >
                  Google and Outlook cannot reach <span className="font-medium">localhost</span>,
                  so they show an empty calendar named something like “Web Local
                  3000”. Use <span className="font-medium">Download .ics</span>{" "}
                  now to see events, or subscribe again after this is deployed on
                  your public app URL (then it will be named{" "}
                  <span className="font-medium">Profit Coach Calls</span>).
                </div>
              ) : null}

              {!remoteSubscribeDisabled && urls.eventCount === 0 ? (
                <div
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600"
                  role="status"
                >
                  Your feed is ready, but there are no upcoming calls in range
                  for your membership right now.
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void downloadIcs()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download .ics
                {urls.eventCount > 0 ? ` (${urls.eventCount} events)` : ""}
              </button>
              {downloadError ? (
                <p className="text-sm text-rose-700" role="alert">
                  {downloadError}
                </p>
              ) : null}

              {remoteSubscribeDisabled ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    After deploy
                  </p>
                  <button
                    type="button"
                    disabled
                    className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
                  >
                    Google Calendar
                  </button>
                  <a
                    href={urls.appleUrl}
                    className="flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Apple Calendar
                  </a>
                  <button
                    type="button"
                    disabled
                    className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
                  >
                    Outlook
                  </button>
                </>
              ) : (
                <>
                  <a
                    href={urls.googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Google Calendar
                  </a>
                  <a
                    href={urls.appleUrl}
                    className="flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Apple Calendar
                  </a>
                  <a
                    href={urls.outlookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Outlook
                  </a>
                </>
              )}

              <button
                type="button"
                onClick={() => void copyFeedUrl()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy feed link
                  </>
                )}
              </button>
              <p className="text-xs leading-relaxed text-slate-500">
                Includes the live calls your membership can access (Win The Week,
                Profit Coach Training, Monthly Momentum, and any others). Keep
                this link private — anyone with it can see your call schedule.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type CommunityCalendarSubscribeButtonProps = {
  className?: string;
};

export function CommunityCalendarSubscribeButton({
  className,
}: CommunityCalendarSubscribeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        }
      >
        <CalendarPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Subscribe
      </button>
      <CommunityCalendarSubscribeModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
