"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Loader2, X, XCircle } from "lucide-react";
import {
  SALES_NAV_IMPORT_WATCH_EVENT,
  dismissSalesNavImportProgressToast,
  isSalesNavImportProgressToastDismissed,
  listWatchedSalesNavImports,
  requestSalesNavImportResume,
  unwatchSalesNavImport,
  type WatchedSalesNavImport,
} from "@/lib/salesNavigator/importJobWatch";
import {
  formatApproxImportDuration,
  requestedTakePagesFromTargetCount,
} from "@/lib/salesNavigator/importSizing";
import { supabaseClient } from "@/lib/supabaseClient";

type ToastState =
  | {
      kind: "progress";
      jobId: string;
      name: string | null;
      progressCount: number;
      targetCount: number;
      phase: "scraping" | "finalizing";
    }
  | {
      kind: "success";
      jobId: string;
      name: string | null;
      scrapedCount: number;
      targetCount: number | null;
    }
  | {
      kind: "error";
      jobId: string;
      name: string | null;
      message: string;
    };

type PollBody = {
  status?: string;
  scrapedCount?: number;
  progressCount?: number;
  targetCount?: number | null;
  phase?: "scraping" | "finalizing" | null;
  error?: string | null;
  run?: {
    name?: string | null;
    scrapedCount?: number;
    progressCount?: number;
    targetCount?: number | null;
    phase?: "scraping" | "finalizing" | null;
  };
};

/** ~25s — pages take ~7–11s; no need to hammer Apify. */
const POLL_MS = 25_000;
const SUCCESS_TOAST_MS = 8000;
const ERROR_TOAST_MS = 10_000;
const LEAD_FINDER_PATH = "/admin/lead-finder";

async function authHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

function resumeHref(jobId: string) {
  return `${LEAD_FINDER_PATH}?importRun=${encodeURIComponent(jobId)}`;
}

/**
 * Global bottom-right toasts for Sales Nav imports:
 * - orange sticky while in progress (dismissible; click to resume)
 * - green / red when finished (if user left Lead Finder)
 */
export function SalesNavImportToast() {
  const router = useRouter();
  const pathname = usePathname();
  const [watched, setWatched] = useState<WatchedSalesNavImport[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [progressById, setProgressById] = useState<
    Record<
      string,
      {
        progressCount: number;
        targetCount: number;
        name: string | null;
        phase: "scraping" | "finalizing";
      }
    >
  >({});

  const refreshWatched = useCallback(() => {
    setWatched(listWatchedSalesNavImports());
  }, []);

  useEffect(() => {
    refreshWatched();
    const onChange = () => refreshWatched();
    window.addEventListener(SALES_NAV_IMPORT_WATCH_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SALES_NAV_IMPORT_WATCH_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refreshWatched]);

  useEffect(() => {
    if (watched.length === 0) {
      setToast((t) => (t?.kind === "progress" ? null : t));
      return;
    }
    let cancelled = false;

    async function tick() {
      const headers = await authHeaders();
      if (!headers || cancelled) return;

      for (const job of listWatchedSalesNavImports()) {
        if (cancelled) return;
        try {
          const res = await fetch(
            `/api/admin/lead-finder/sales-nav-import-runs/${job.id}`,
            { headers }
          );
          const body = (await res.json().catch(() => ({}))) as PollBody;
          if (!res.ok) continue;

          const targetCount = Math.max(
            1,
            body.targetCount ??
              body.run?.targetCount ??
              job.targetCount ??
              1
          );
          const progressCount = Math.max(
            0,
            body.progressCount ??
              body.run?.progressCount ??
              body.scrapedCount ??
              0
          );
          const name = body.run?.name?.trim() || job.name;

          if (body.status === "succeeded") {
            unwatchSalesNavImport(job.id);
            if (cancelled) return;
            setToast({
              kind: "success",
              jobId: job.id,
              name,
              scrapedCount:
                body.scrapedCount ??
                body.run?.scrapedCount ??
                progressCount,
              targetCount,
            });
            refreshWatched();
            return;
          }

          if (body.status === "failed") {
            unwatchSalesNavImport(job.id);
            if (cancelled) return;
            setToast({
              kind: "error",
              jobId: job.id,
              name,
              message: body.error?.trim() || "Import failed.",
            });
            refreshWatched();
            return;
          }

          setProgressById((prev) => ({
            ...prev,
            [job.id]: {
              progressCount,
              targetCount,
              name,
              phase:
                body.phase === "finalizing" ||
                body.run?.phase === "finalizing" ||
                progressCount >= targetCount
                  ? "finalizing"
                  : "scraping",
            },
          }));
        } catch {
          // keep watching
        }
      }
    }

    void tick();
    const handle = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [watched, refreshWatched]);

  // Prefer sticky progress toast when something is still running (unless dismissed
  // or the user is already on Lead Finder watching the panel).
  useEffect(() => {
    if (toast?.kind === "success" || toast?.kind === "error") return;
    if (pathname?.startsWith(LEAD_FINDER_PATH)) {
      setToast((t) => (t?.kind === "progress" ? null : t));
      return;
    }

    const active = watched.find(
      (j) => !isSalesNavImportProgressToastDismissed(j.id)
    );
    if (!active) {
      setToast((t) => (t?.kind === "progress" ? null : t));
      return;
    }

    const live = progressById[active.id];
    setToast({
      kind: "progress",
      jobId: active.id,
      name: live?.name ?? active.name,
      progressCount: live?.progressCount ?? 0,
      targetCount: live?.targetCount || active.targetCount || 1,
      phase: live?.phase ?? "scraping",
    });
  }, [watched, progressById, toast?.kind, pathname]);

  useEffect(() => {
    if (!toast || toast.kind === "progress") {
      if (toast?.kind === "progress") setToastVisible(true);
      return;
    }
    const ttl = toast.kind === "error" ? ERROR_TOAST_MS : SUCCESS_TOAST_MS;
    setToastVisible(false);
    const enter = window.setTimeout(() => setToastVisible(true), 20);
    const leave = window.setTimeout(() => setToastVisible(false), ttl - 400);
    const clear = window.setTimeout(() => setToast(null), ttl);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(leave);
      window.clearTimeout(clear);
    };
  }, [toast]);

  if (!toast) return null;

  const onLeadFinder = pathname?.startsWith(LEAD_FINDER_PATH);
  const bottomClass = onLeadFinder
    ? "bottom-20 sm:bottom-20"
    : "bottom-5 sm:bottom-6";

  const colorClass =
    toast.kind === "success"
      ? "bg-emerald-500 text-white shadow-emerald-900/15"
      : toast.kind === "error"
        ? "bg-rose-600 text-white shadow-rose-900/20"
        : "bg-amber-500 text-white shadow-amber-900/15";

  const title =
    toast.kind === "success"
      ? `Imported ${toast.scrapedCount.toLocaleString()} ${
          toast.scrapedCount === 1 ? "person" : "people"
        }${
          toast.targetCount && toast.scrapedCount < toast.targetCount
            ? ` of ${toast.targetCount.toLocaleString()} requested`
            : ""
        }`
      : toast.kind === "error"
        ? "Sales Nav import failed"
        : toast.phase === "finalizing"
          ? "Finishing up"
          : "In progress";

  const progressShown =
    toast.kind === "progress" ? toast.progressCount : 0;
  const approx =
    toast.kind === "progress"
      ? formatApproxImportDuration(
          requestedTakePagesFromTargetCount(toast.targetCount)
        )
      : null;

  const detail =
    toast.kind === "error"
      ? toast.message
      : toast.kind === "progress"
        ? [
            toast.name ? `“${toast.name}”` : null,
            toast.phase === "finalizing"
              ? `${progressShown.toLocaleString()} scraped · saving`
              : `${progressShown.toLocaleString()} / ${toast.targetCount.toLocaleString()}`,
            toast.phase === "finalizing" ? null : approx,
          ]
            .filter(Boolean)
            .join(" · ")
        : toast.name
          ? `“${toast.name}”`
          : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-5 z-[60] flex max-w-[min(22rem,calc(100vw-2.5rem))] items-start gap-3 rounded-lg px-3.5 py-3 text-sm font-medium shadow-lg transition-all duration-500 ease-out sm:right-6 ${bottomClass} ${colorClass} ${
        toastVisible || toast.kind === "progress"
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0"
      }`}
    >
      {toast.kind === "success" ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : toast.kind === "error" ? (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : (
        <Loader2
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin"
          strokeWidth={2.5}
          aria-hidden
        />
      )}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          if (toast.kind === "progress" || toast.kind === "success") {
            const id = toast.jobId;
            setToast(null);
            if (pathname?.startsWith(LEAD_FINDER_PATH)) {
              requestSalesNavImportResume(id);
              router.replace(resumeHref(id), { scroll: false });
            } else {
              router.push(resumeHref(id));
            }
          }
        }}
      >
        <p className="leading-snug">{title}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-xs font-normal opacity-90">
            {detail}
          </p>
        ) : null}
        {toast.kind === "progress" ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-700"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (Math.min(toast.progressCount, toast.targetCount) /
                      Math.max(1, toast.targetCount)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        ) : null}
        {toast.kind === "success" ? (
          <span className="mt-1.5 inline-block text-xs font-semibold underline underline-offset-2">
            View
          </span>
        ) : toast.kind === "progress" ? (
          <span className="mt-1.5 inline-block text-xs font-semibold underline underline-offset-2">
            Open
          </span>
        ) : null}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 opacity-80 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          if (toast.kind === "progress") {
            dismissSalesNavImportProgressToast(toast.jobId);
          }
          setToast(null);
        }}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
