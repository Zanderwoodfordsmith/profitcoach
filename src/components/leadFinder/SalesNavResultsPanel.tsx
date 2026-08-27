"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Download,
  ExternalLink,
  History,
  Loader2,
  Settings2,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { SalesNavImportedLead } from "@/lib/apify/salesNavigatorTypes";
import { SALES_NAV_MAX_TAKE_PAGES } from "@/lib/apify/salesNavigatorTypes";
import { downloadSalesNavLeadsCsv } from "@/lib/salesNavigator/exportSalesNavLeadsCsv";
import { isSalesNavSearchUrl } from "@/lib/salesNavigator/isSalesNavSearchUrl";
import {
  unwatchSalesNavImport,
  watchSalesNavImport,
} from "@/lib/salesNavigator/importJobWatch";
import {
  formatApproxImportDuration,
  requestedTakePagesFromTargetCount,
} from "@/lib/salesNavigator/importSizing";
import { supabaseClient } from "@/lib/supabaseClient";

const COOKIE_STORAGE_KEY = "lead-finder-sales-nav-cookie";
const URL_OVERRIDE_STORAGE_KEY = "lead-finder-sales-nav-url-override";

/** How many leads to pull from Sales Nav (25 per Sales Nav search page). */
const IMPORT_SIZE_OPTIONS = [
  { pages: 1, label: "25" },
  { pages: 2, label: "50" },
  { pages: 4, label: "100" },
  { pages: 10, label: "250" },
  { pages: 20, label: "500" },
  { pages: 40, label: "1,000" },
  { pages: 80, label: "2,000" },
  { pages: 100, label: "2,500" },
].filter((o) => o.pages <= SALES_NAV_MAX_TAKE_PAGES);

const RESULTS_PAGE_SIZES = [25, 50, 100] as const;

type ImportStartResponse = {
  jobId?: string;
  status?: string;
  takePages?: number;
  targetCount?: number;
  progressCount?: number;
  estimatedCostUsd?: number;
  segmented?: boolean;
  segmentTotal?: number;
  segmentLabels?: string[];
  async?: boolean;
  error?: string;
};

type ImportPollResponse = {
  status?: "pending" | "running" | "succeeded" | "failed";
  progressCount?: number;
  targetCount?: number | null;
  scrapeTargetCount?: number | null;
  phase?: "scraping" | "finalizing" | null;
  scrapedCount?: number;
  scrapedTotal?: number;
  durationMs?: number | null;
  error?: string | null;
  leads?: SalesNavImportedLead[];
  /** Full lead_snapshot (unsliced) for CSV export. */
  exportLeads?: SalesNavImportedLead[];
  run?: {
    name?: string | null;
    salesNavUrl?: string | null;
    createdAt?: string;
    durationMs?: number | null;
    scrapedCount?: number;
    scrapedTotal?: number;
    targetCount?: number | null;
    scrapeTargetCount?: number | null;
    phase?: "scraping" | "finalizing" | null;
    segmented?: boolean;
    segmentIndex?: number;
    segmentTotal?: number;
    segmentLabel?: string | null;
  };
};

type ImportResponse = {
  leads?: SalesNavImportedLead[];
  scrapedCount?: number;
  savedCount?: number;
  durationMs?: number;
  importRunId?: string | null;
  auditLogOk?: boolean;
  auditLogError?: string | null;
  error?: string;
};

type HistoryRun = {
  id: string;
  name: string | null;
  status?: "pending" | "running" | "succeeded" | "failed";
  createdAt: string;
  scrapedCount: number;
  scrapedTotal?: number;
  progressCount?: number;
  targetCount?: number | null;
  takePages: number | null;
  requestedTakePages?: number | null;
  durationMs: number | null;
  estimatedCostUsd: number;
  salesNavUrl: string | null;
  cacheInserted: number;
  cacheUpdated: number;
  errorMessage?: string | null;
};

const IMPORT_POLL_MS = 25_000;

type UrlSource = "filters" | "paste";

type Props = {
  /** URL built from the left-hand filters. */
  salesNavUrl: string;
  /** Fired when parent wants Import (e.g. sidebar button). */
  importNonce?: number;
  /** Open this History run once (e.g. toast View deep-link). */
  openImportRunId?: string | null;
  /** Called after openImportRunId has been handled (success or fail). */
  onOpenImportRunHandled?: () => void;
  /** Optional secondary actions in the Profiles toolbar (e.g. Suggest). */
  headerActions?: ReactNode;
};

export function SalesNavResultsPanel({
  salesNavUrl,
  importNonce = 0,
  openImportRunId = null,
  onOpenImportRunHandled,
  headerActions,
}: Props) {
  const [cookie, setCookie] = useState("");
  const [accountSessionAt, setAccountSessionAt] = useState<string | null>(null);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpeningId, setHistoryOpeningId] = useState<string | null>(null);
  const [historyCsvExportingId, setHistoryCsvExportingId] = useState<
    string | null
  >(null);
  const [takePages, setTakePages] = useState(4);
  const [urlSource, setUrlSource] = useState<UrlSource>("filters");
  const [pastedUrl, setPastedUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    progressCount: number;
    targetCount: number;
    phase: "scraping" | "finalizing";
    segmentLabel?: string | null;
    segmentIndex?: number;
    segmentTotal?: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<SalesNavImportedLead[] | null>(null);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPageSize, setResultsPageSize] =
    useState<(typeof RESULTS_PAGE_SIZES)[number]>(25);
  const [expandedAbout, setExpandedAbout] = useState<Record<number, boolean>>(
    {}
  );
  const mountedRef = useRef(true);
  const pollingJobRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const effectiveUrl = useMemo(() => {
    if (urlSource === "paste") return pastedUrl.trim();
    return salesNavUrl.trim();
  }, [urlSource, pastedUrl, salesNavUrl]);

  const resultsTotalPages = useMemo(() => {
    if (!leads?.length) return 1;
    return Math.max(1, Math.ceil(leads.length / resultsPageSize));
  }, [leads, resultsPageSize]);

  const pageLeads = useMemo(() => {
    if (!leads) return [];
    const start = (resultsPage - 1) * resultsPageSize;
    return leads.slice(start, start + resultsPageSize);
  }, [leads, resultsPage, resultsPageSize]);

  useEffect(() => {
    setResultsPage((p) => Math.min(p, resultsTotalPages));
  }, [resultsTotalPages]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(COOKIE_STORAGE_KEY);
      if (stored) setCookie(stored);
      const storedUrl = window.sessionStorage.getItem(URL_OVERRIDE_STORAGE_KEY);
      if (storedUrl?.trim()) {
        setPastedUrl(storedUrl);
        setUrlSource("paste");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      try {
        const res = await fetch("/api/sales-nav-session", { headers });
        const body = (await res.json().catch(() => ({}))) as {
          hasSession?: boolean;
          updatedAt?: string | null;
        };
        if (res.ok && body.hasSession) {
          setAccountSessionAt(body.updatedAt ?? "saved");
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (importNonce > 0) void runImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent trigger only
  }, [importNonce]);

  useEffect(() => {
    if (!openImportRunId?.trim()) return;
    const id = openImportRunId.trim();
    // Clear the deep-link trigger immediately so URL/state don't fight the resume.
    onOpenImportRunHandled?.();
    void openOrResumeImportRun(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link once per id
  }, [openImportRunId]);

  async function authHeaders() {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  function persistCookie(next: string) {
    setCookie(next);
    try {
      if (next.trim()) {
        window.sessionStorage.setItem(COOKIE_STORAGE_KEY, next);
      } else {
        window.sessionStorage.removeItem(COOKIE_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  function persistPastedUrl(next: string) {
    setPastedUrl(next);
    try {
      if (next.trim()) {
        window.sessionStorage.setItem(URL_OVERRIDE_STORAGE_KEY, next.trim());
      } else {
        window.sessionStorage.removeItem(URL_OVERRIDE_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setHistoryError("Not signed in.");
        return;
      }
      const res = await fetch("/api/admin/lead-finder/sales-nav-import-runs", {
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as {
        runs?: HistoryRun[];
        error?: string;
      };
      if (!res.ok) {
        setHistoryError(body.error ?? "Could not load history.");
        return;
      }
      setHistoryRuns(body.runs ?? []);
    } catch {
      setHistoryError("Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistoryRun(runId: string) {
    setHistoryOpeningId(runId);
    setHistoryError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setHistoryError("Not signed in.");
        return;
      }
      const res = await fetch(
        `/api/admin/lead-finder/sales-nav-import-runs/${runId}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as ImportPollResponse & {
        run?: HistoryRun & { status?: string; targetCount?: number | null };
      };
      if (!res.ok) {
        setHistoryError(body.error ?? "Could not open import.");
        return;
      }
      const status = body.status ?? body.run?.status ?? "succeeded";
      if (status === "running" || status === "pending") {
        setHistoryOpen(false);
        await resumeRunningImport(runId, headers, body);
        return;
      }
      if (status === "failed") {
        setHistoryError(body.error || "That import failed.");
        return;
      }
      applyCompletedImport(body);
      setHistoryOpen(false);
    } catch {
      setHistoryError("Could not open import.");
    } finally {
      setHistoryOpeningId(null);
    }
  }

  async function openOrResumeImportRun(runId: string) {
    if (pollingJobRef.current === runId) return;
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      return;
    }
    const res = await fetch(
      `/api/admin/lead-finder/sales-nav-import-runs/${runId}`,
      { headers }
    );
    const body = (await res.json().catch(() => ({}))) as ImportPollResponse;
    if (!res.ok) {
      setError(body.error || "Could not open import.");
      return;
    }
    const status = body.status ?? "succeeded";
    if (status === "running" || status === "pending") {
      await resumeRunningImport(runId, headers, body);
      return;
    }
    if (status === "failed") {
      setError(body.error || "That import failed.");
      return;
    }
    applyCompletedImport(body);
  }

  function applyCompletedImport(body: ImportPollResponse) {
    const nextLeads = body.exportLeads ?? body.leads ?? [];
    const delivered = body.scrapedCount ?? nextLeads.length;
    const target = body.targetCount ?? body.run?.targetCount ?? null;
    const total = body.scrapedTotal ?? delivered;
    setLeads(nextLeads);
    setScrapedCount(delivered);
    setResultsPage(1);
    setLastDurationMs(
      typeof body.durationMs === "number"
        ? body.durationMs
        : body.run?.durationMs ?? null
    );
    if (body.run?.name?.trim()) setImportName(body.run.name.trim());
    if (target != null && delivered < target) {
      setSavedNote(
        `Showing ${delivered.toLocaleString()} of ${target.toLocaleString()} requested — this search didn’t yield more.`
      );
    } else if (total > delivered) {
      setSavedNote(
        `Showing ${delivered.toLocaleString()} people (extra scraped into the pool).`
      );
    } else if (body.run?.name?.trim()) {
      setSavedNote(`Showing “${body.run.name.trim()}”.`);
    } else if (body.run?.createdAt) {
      setSavedNote(
        `Showing import from ${new Date(body.run.createdAt).toLocaleString()}.`
      );
    } else {
      setSavedNote("Showing import from history.");
    }
    setError(null);
    setExpandedAbout({});
    if (body.run?.salesNavUrl) {
      persistPastedUrl(body.run.salesNavUrl);
      setUrlSource("paste");
    }
  }

  async function resumeRunningImport(
    jobId: string,
    headers: Record<string, string>,
    seed?: ImportPollResponse
  ) {
    if (pollingJobRef.current === jobId) return;
    pollingJobRef.current = jobId;
    const targetCount = Math.max(
      1,
      seed?.targetCount ??
        seed?.run?.targetCount ??
        takePages * 25
    );
    watchSalesNavImport({
      id: jobId,
      name: seed?.run?.name ?? (importName.trim() || null),
      targetCount,
    });
    setError(null);
    setSavedNote(null);
    setLeads(null);
    setLoading(true);
    setImportProgress({
      progressCount: seed?.progressCount ?? 0,
      targetCount,
      phase:
        seed?.phase === "finalizing" ||
        (seed?.progressCount ?? 0) >= targetCount
          ? "finalizing"
          : "scraping",
    });
    setHistoryOpen(false);
    try {
      const done = await pollImportJob(jobId, headers, targetCount);
      if (done === "left") return;
      unwatchSalesNavImport(jobId);
      if (!mountedRef.current) return;
      applyCompletedImport(done);
    } catch (err) {
      if (mountedRef.current) {
        unwatchSalesNavImport(jobId);
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    } finally {
      if (pollingJobRef.current === jobId) pollingJobRef.current = null;
      if (mountedRef.current) {
        setLoading(false);
        setImportProgress(null);
      }
    }
  }

  async function exportHistoryRunCsv(runId: string, runName?: string | null) {
    setHistoryError(null);
    setHistoryCsvExportingId(runId);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setHistoryError("Not signed in.");
        return;
      }
      const res = await fetch(
        `/api/admin/lead-finder/sales-nav-import-runs/${runId}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as ImportPollResponse & {
        error?: string;
      };
      if (!res.ok) {
        setHistoryError(body.error ?? "Could not export import.");
        return;
      }
      const status = body.status ?? "succeeded";
      if (status === "running" || status === "pending") {
        setHistoryError("Import still running — try again when it finishes.");
        return;
      }
      if (status === "failed") {
        setHistoryError(body.error || "That import failed.");
        return;
      }
      const exportLeads = body.exportLeads ?? body.leads ?? [];
      if (!exportLeads.length) {
        setHistoryError("No leads to export for that import.");
        return;
      }
      downloadSalesNavLeadsCsv(exportLeads, {
        name: runName?.trim() || body.run?.name?.trim() || undefined,
      });
    } catch {
      setHistoryError("Could not export CSV.");
    } finally {
      setHistoryCsvExportingId(null);
    }
  }

  function exportVisibleLeads() {
    if (!leads?.length) return;
    downloadSalesNavLeadsCsv(leads, {
      name: importName.trim() || undefined,
    });
  }

  async function renameHistoryRun(runId: string, nextName: string) {
    const headers = await authHeaders();
    if (!headers) {
      setHistoryError("Not signed in.");
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/lead-finder/sales-nav-import-runs/${runId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ name: nextName }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        name?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setHistoryError(body.error ?? "Could not rename.");
        return;
      }
      setHistoryRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? { ...r, name: body.name?.trim() ? body.name.trim() : null }
            : r
        )
      );
    } catch {
      setHistoryError("Could not rename.");
    }
  }

  async function deleteHistoryRun(runId: string, label: string) {
    const ok = window.confirm(`Remove “${label}” from History?`);
    if (!ok) return;

    const headers = await authHeaders();
    if (!headers) {
      setHistoryError("Not signed in.");
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/lead-finder/sales-nav-import-runs/${runId}`,
        { method: "DELETE", headers }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setHistoryError(body.error ?? "Could not delete.");
        return;
      }
      setHistoryRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch {
      setHistoryError("Could not delete.");
    }
  }

  async function pollImportJob(
    jobId: string,
    headers: Record<string, string>,
    targetCount: number
  ): Promise<ImportPollResponse | "left"> {
    const started = Date.now();
    const maxWaitMs = 45 * 60 * 1000;
    while (Date.now() - started < maxWaitMs) {
      if (!mountedRef.current) return "left";

      const res = await fetch(
        `/api/admin/lead-finder/sales-nav-import-runs/${jobId}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as ImportPollResponse;
      if (!res.ok) {
        throw new Error(body.error || "Could not check import progress.");
      }

      const progress = Math.max(
        0,
        body.progressCount ?? body.scrapedCount ?? 0
      );
      const target = Math.max(
        1,
        body.targetCount ?? targetCount ?? takePages * 25
      );
      if (mountedRef.current) {
        const phase =
          body.phase === "finalizing" || progress >= target
            ? "finalizing"
            : "scraping";
        setImportProgress({
          progressCount: progress,
          targetCount: target,
          phase,
          segmentLabel: body.run?.segmentLabel ?? null,
          segmentIndex: body.run?.segmentIndex,
          segmentTotal: body.run?.segmentTotal,
        });
      }

      if (body.status === "succeeded") {
        return body;
      }
      if (body.status === "failed") {
        throw new Error(body.error || "Import failed.");
      }

      await new Promise((r) => setTimeout(r, IMPORT_POLL_MS));
    }
    throw new Error(
      "Import is still running after 45 minutes. Check History later — it continues in the background."
    );
  }

  async function runImport(cookieOverride?: string) {
    setError(null);
    setSavedNote(null);
    setLastDurationMs(null);
    setImportProgress(null);
    setExpandedAbout({});

    if (!effectiveUrl) {
      setError(
        urlSource === "paste"
          ? "Paste a Sales Navigator people-search URL."
          : "Set filters on the left to build a Sales Navigator search."
      );
      return;
    }
    if (!isSalesNavSearchUrl(effectiveUrl)) {
      setError(
        "URL must be a LinkedIn Sales Navigator people search (…/sales/search/people…)."
      );
      return;
    }

    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      return;
    }

    const cookieToUse =
      (cookieOverride ?? cookie).trim() ||
      (() => {
        try {
          return window.sessionStorage.getItem(COOKIE_STORAGE_KEY)?.trim() || "";
        } catch {
          return "";
        }
      })();

    setLoading(true);
    setLeads(null);
    let jobId: string | null = null;
    try {
      const payload: Record<string, unknown> = {
        salesNavUrl: effectiveUrl,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        takePages,
        save: false,
      };
      if (importName.trim()) payload.name = importName.trim();
      // Prefer pasted/session cookie; omit so the server can use LINKEDIN_SALES_NAV_COOKIE.
      if (cookieToUse) payload.cookie = cookieToUse;

      const res = await fetch("/api/admin/lead-finder/sales-nav-import", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as ImportStartResponse;
      if (!res.ok) {
        const message = body.error ?? "Import failed.";
        setError(message);
        if (
          res.status === 503 ||
          /cookie|session|not configured|stale|Cookie-Editor/i.test(message)
        ) {
          setSettingsOpen(true);
        }
        return;
      }

      if (!body.jobId) {
        setError("Import started but no job id was returned.");
        return;
      }

      jobId = body.jobId;
      const targetCount = body.targetCount ?? takePages * 25;
      pollingJobRef.current = jobId;
      watchSalesNavImport({
        id: jobId,
        name: importName.trim() || null,
        targetCount,
      });
      if (body.segmented && (body.segmentTotal ?? 0) > 1) {
        setSavedNote(
          `Running ${body.segmentTotal} team-size segments: ${(body.segmentLabels ?? []).join(", ")}.`
        );
      }
      setImportProgress({
        progressCount: 0,
        targetCount,
        phase: "scraping",
        segmentLabel: body.segmentLabels?.[0] ?? null,
        segmentIndex: 0,
        segmentTotal: body.segmentTotal,
      });

      const done = await pollImportJob(jobId, headers, targetCount);
      if (done === "left") {
        // Global toast will finish + notify.
        return;
      }

      unwatchSalesNavImport(jobId);
      if (!mountedRef.current) return;

      applyCompletedImport(done);
    } catch (err) {
      if (jobId) {
        if (mountedRef.current) unwatchSalesNavImport(jobId);
        // If user left mid-fail, toast poll will surface the failure.
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    } finally {
      if (jobId && pollingJobRef.current === jobId) {
        pollingJobRef.current = null;
      }
      if (mountedRef.current) {
        setLoading(false);
        setImportProgress(null);
      }
    }
  }

  async function saveAsList() {
    if (!leads?.length) return;
    setError(null);
    setSavedNote(null);
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/lead-finder/sales-nav-import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          salesNavUrl: effectiveUrl,
          save: true,
          leads,
          name: importName.trim() || undefined,
          listName:
            importName.trim() ||
            `Sales Nav — ${new Date().toISOString().slice(0, 10)}`,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as ImportResponse;
      if (!res.ok) {
        setError(body.error ?? "Save failed.");
        return;
      }
      setSavedNote(
        `Saved ${body.savedCount ?? leads.length} leads to a coach list.`
      );
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const hasCookie = Boolean(cookie.trim());
  const hasAccountSession = Boolean(accountSessionAt);
  const sessionLabel = hasAccountSession
    ? "Account session"
    : hasCookie
      ? "Tab session"
      : "Session";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
            Profiles
            {leads ? (
              <span className="ml-2 font-normal text-slate-400">
                {scrapedCount}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {urlSource === "paste"
              ? "Importing from pasted Sales Nav URL."
              : "Import from left-hand filters, or paste a Sales Nav URL below."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          <button
            type="button"
            onClick={() => void openHistory()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            title="Import history"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            title="Sales Navigator session"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {hasAccountSession || hasCookie ? (
              <span className="text-emerald-700">{sessionLabel}</span>
            ) : (
              <span>{sessionLabel}</span>
            )}
          </button>
          <a
            href={effectiveUrl || salesNavUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </a>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runImport()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {importProgress
                  ? importProgress.phase === "finalizing"
                    ? "Finishing…"
                    : `${importProgress.progressCount.toLocaleString()} / ${importProgress.targetCount.toLocaleString()}`
                  : "Starting…"}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import
              </>
            )}
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Import from
          </span>
          {(
            [
              { id: "filters" as const, label: "Filters" },
              { id: "paste" as const, label: "Paste URL" },
            ] as const
          ).map((opt) => {
            const on = urlSource === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUrlSource(opt.id)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                  on
                    ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
                    : "border border-dashed border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {urlSource === "paste" ? (
          <label className="mt-2 block">
            <textarea
              value={pastedUrl}
              onChange={(e) => persistPastedUrl(e.target.value)}
              rows={2}
              placeholder="https://www.linkedin.com/sales/search/people?query=…"
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
              spellCheck={false}
            />
            {pastedUrl.trim() && !isSalesNavSearchUrl(pastedUrl.trim()) ? (
              <p className="mt-1 text-xs text-rose-600">
                Needs a Sales Navigator people-search URL.
              </p>
            ) : null}
          </label>
        ) : null}
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Import name{" "}
            <span className="font-normal normal-case tracking-normal text-slate-400">
              (optional)
            </span>
          </span>
          <input
            type="text"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            placeholder="e.g. UK owners · 11–50 · &lt;1 yr · posted 30d"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
          />
        </label>
        <label className="mt-2 block max-w-xs">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Import up to
          </span>
          <select
            value={takePages}
            onChange={(e) => setTakePages(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {IMPORT_SIZE_OPTIONS.map((o) => (
              <option key={o.pages} value={o.pages}>
                {o.label} people
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        {error ? (
          <p className="mb-4 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {savedNote ? (
          <p className="mb-4 inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <Check className="h-4 w-4" />
            {savedNote}
          </p>
        ) : null}

        {loading ? (
          <div className="py-16">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              <p className="text-sm font-medium text-slate-800">
                {importProgress?.phase === "finalizing"
                  ? "Finishing import…"
                  : "Importing in the background…"}
              </p>
              <p className="text-sm text-slate-500">
                {importProgress?.phase === "finalizing"
                  ? "Requested amount reached — finishing import."
                  : "Feel free to leave this page — we’ll toast you when it’s done."}
              </p>
              {importProgress ? (
                <div className="mt-2 w-full">
                  <div className="mb-1.5 flex justify-between gap-3 text-xs text-slate-500">
                    <span>
                      {importProgress.phase === "finalizing"
                        ? `Finishing · ${importProgress.progressCount.toLocaleString()} scraped`
                        : importProgress.segmentTotal && importProgress.segmentTotal > 1
                          ? `Segment ${(importProgress.segmentIndex ?? 0) + 1}/${importProgress.segmentTotal}${importProgress.segmentLabel ? ` (${importProgress.segmentLabel})` : ""} · ${importProgress.progressCount.toLocaleString()} total`
                          : `In progress · ${importProgress.progressCount.toLocaleString()} / ${importProgress.targetCount.toLocaleString()}`}
                    </span>
                    <span>
                      {formatApproxImportDuration(
                        requestedTakePagesFromTargetCount(
                          importProgress.targetCount
                        )
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-800 transition-[width] duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (importProgress.progressCount /
                              Math.max(1, importProgress.targetCount)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : leads === null ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-800">
              No profiles imported yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Use the left-hand filters, or switch to Paste URL for a Sales Nav
              link you already built, then Import.
            </p>
          </div>
        ) : leads.length === 0 ? (
          <p className="py-12 text-sm text-slate-500">No profiles returned.</p>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">
                {scrapedCount.toLocaleString()}{" "}
                {scrapedCount === 1 ? "person" : "people"}
                {lastDurationMs != null ? (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    · {formatImportDuration(lastDurationMs)}
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={() => exportVisibleLeads()}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAsList()}
                className="text-xs font-medium text-sky-700 hover:underline disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save as coach list"}
              </button>
            </div>

            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {pageLeads.map((lead, i) => {
                const absoluteIndex =
                  (resultsPage - 1) * resultsPageSize + i;
                return (
                  <SalesNavLeadRow
                    key={`${lead.linkedinUrl ?? lead.fullName}-${absoluteIndex}`}
                    lead={lead}
                    aboutOpen={Boolean(expandedAbout[absoluteIndex])}
                    onToggleAbout={() =>
                      setExpandedAbout((prev) => ({
                        ...prev,
                        [absoluteIndex]: !prev[absoluteIndex],
                      }))
                    }
                  />
                );
              })}
            </ul>
          </div>
        )}
        </div>

        {leads && leads.length > 0 ? (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-2.5 backdrop-blur sm:px-6">
            <p className="text-xs text-slate-500">
              {(resultsPage - 1) * resultsPageSize + 1}–
              {Math.min(resultsPage * resultsPageSize, leads.length)} of{" "}
              {leads.length.toLocaleString()}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                Per page
                <select
                  value={resultsPageSize}
                  onChange={(e) => {
                    setResultsPageSize(
                      Number(e.target.value) as (typeof RESULTS_PAGE_SIZES)[number]
                    );
                    setResultsPage(1);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900"
                >
                  {RESULTS_PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={resultsPage <= 1}
                  onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-slate-600">
                  {resultsPage} / {resultsTotalPages}
                </span>
                <button
                  type="button"
                  disabled={resultsPage >= resultsTotalPages}
                  onClick={() =>
                    setResultsPage((p) => Math.min(resultsTotalPages, p + 1))
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Import history"
        subtitle="Re-open leads from a past Sales Navigator import on this account."
        maxWidthClassName="max-w-lg"
      >
        <div className="px-5 py-4">
          {historyError ? (
            <p className="mb-3 text-sm text-rose-700" role="alert">
              {historyError}
            </p>
          ) : null}
          {historyLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : historyRuns.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No imports yet. After you import, they appear here so you can come
              back and view the leads.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {historyRuns.map((run) => {
                const status = run.status ?? "succeeded";
                const inProgress =
                  status === "running" || status === "pending";
                const canOpen = status === "succeeded" || inProgress;
                const statusLabel = inProgress
                  ? (run.progressCount ?? 0) >= (run.targetCount ?? Infinity)
                    ? `Finishing · ${(run.progressCount ?? 0).toLocaleString()} scraped`
                    : `In progress · ${(
                        run.progressCount ?? 0
                      ).toLocaleString()}${
                        run.targetCount
                          ? ` / ${run.targetCount.toLocaleString()}`
                          : ""
                      }`
                  : status === "failed"
                    ? "Failed"
                    : null;
                return (
                <li key={run.id} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      disabled={!canOpen || historyOpeningId === run.id}
                      onClick={() => {
                        if (canOpen) void openHistoryRun(run.id);
                      }}
                      className="min-w-0 flex-1 text-left transition hover:opacity-80 disabled:cursor-default disabled:opacity-100"
                    >
                      <p className="truncate text-sm font-medium text-slate-900">
                        {run.name?.trim() ||
                          new Date(run.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {run.name?.trim()
                          ? new Date(run.createdAt).toLocaleString() + " · "
                          : ""}
                        {statusLabel
                          ? statusLabel
                          : `${run.scrapedCount.toLocaleString()} leads`}
                        {status === "succeeded" &&
                        run.targetCount != null &&
                        run.scrapedCount < run.targetCount
                          ? ` of ${run.targetCount.toLocaleString()} requested`
                          : ""}
                        {status === "succeeded" && run.requestedTakePages != null
                          ? ` · ${run.requestedTakePages} pages`
                          : status === "succeeded" && run.takePages != null
                            ? ` · ${run.takePages} pages`
                            : ""}
                        {status === "succeeded" && run.durationMs != null
                          ? ` · ${formatImportDuration(run.durationMs)}`
                          : ""}
                        {status === "failed" && run.errorMessage
                          ? ` · ${run.errorMessage}`
                          : ""}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500 hover:text-slate-800"
                        onClick={() => {
                          const next = window.prompt(
                            "Name this import",
                            run.name ?? ""
                          );
                          if (next == null) return;
                          void renameHistoryRun(run.id, next);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={inProgress}
                        className="text-xs font-medium text-rose-600 hover:text-rose-800 disabled:opacity-40"
                        onClick={() =>
                          void deleteHistoryRun(
                            run.id,
                            run.name?.trim() ||
                              new Date(run.createdAt).toLocaleString()
                          )
                        }
                      >
                        Delete
                      </button>
                      {historyOpeningId === run.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : status === "succeeded" ? (
                        <button
                          type="button"
                          disabled={historyCsvExportingId === run.id}
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline disabled:opacity-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            void exportHistoryRunCsv(run.id, run.name);
                          }}
                        >
                          {historyCsvExportingId === run.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          CSV
                        </button>
                      ) : null}
                      {historyOpeningId === run.id ? null : canOpen ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-sky-700 hover:underline"
                          onClick={() => void openHistoryRun(run.id)}
                        >
                          {inProgress ? "Open" : "View"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setShowPasteFallback(false);
        }}
        title="Sales Navigator session"
        subtitle={
          hasAccountSession
            ? "Import uses the session saved by the Chrome extension."
            : "Use the Chrome extension to save your Sales Navigator login, then import."
        }
        maxWidthClassName="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSettingsOpen(false);
                setShowPasteFallback(false);
                // Only pass paste when the fallback is in use; otherwise
                // server uses the saved account session.
                void runImport(
                  showPasteFallback || !hasAccountSession
                    ? cookie.trim()
                    : undefined
                );
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Import
            </button>
          </div>
        }
      >
        <div className="space-y-3 px-5 py-4">
          {hasAccountSession ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Account session saved
              {accountSessionAt && accountSessionAt !== "saved"
                ? ` · ${new Date(accountSessionAt).toLocaleString()}`
                : ""}
              . Import will use it automatically.
            </p>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              No session yet. On Sales Navigator, open the{" "}
              <strong>Profit Coach for LinkedIn</strong> extension and
              click <strong>Save to my account</strong> (with Profit Coach open
              and signed in).
            </p>
          )}

          {!hasAccountSession || showPasteFallback ? (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {hasAccountSession ? "Different session (paste)" : "Or paste cookies"}
              </span>
              <textarea
                value={cookie}
                onChange={(e) => persistCookie(e.target.value)}
                rows={5}
                placeholder="From the extension: Copy cookies instead"
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setShowPasteFallback(true)}
              className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Use a different session…
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}

function SalesNavLeadRow({
  lead,
  aboutOpen,
  onToggleAbout,
}: {
  lead: SalesNavImportedLead;
  aboutOpen: boolean;
  onToggleAbout: () => void;
}) {
  const name = lead.fullName?.trim() || "Unknown";
  const titleCompany = [lead.jobTitle, lead.company]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" · ");
  const photo =
    lead.photoUrl?.trim() ||
    (typeof lead.raw?.pictureUrl === "string" ? lead.raw.pictureUrl : null);
  const about = lead.headline?.trim() || null;
  const showAboutToggle = Boolean(about && about.length > 160);

  return (
    <li className="flex gap-4 px-4 py-4 sm:px-5">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="mt-0.5 h-14 w-14 shrink-0 rounded-full object-cover bg-slate-100"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500"
          aria-hidden
        >
          {initials(name)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {lead.linkedinUrl ? (
            <a
              href={lead.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[15px] font-semibold text-sky-800 hover:underline"
            >
              {name}
            </a>
          ) : (
            <p className="text-[15px] font-semibold text-slate-900">{name}</p>
          )}
        </div>

        {titleCompany ? (
          <p className="mt-0.5 text-sm font-medium text-slate-800">
            {titleCompany}
          </p>
        ) : null}

        {lead.location?.trim() ? (
          <p className="mt-0.5 text-sm text-slate-500">{lead.location.trim()}</p>
        ) : null}

        {lead.tenureLabel?.trim() ? (
          <p className="mt-0.5 text-xs text-slate-400">{lead.tenureLabel}</p>
        ) : null}

        {about ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            <span className="font-medium text-slate-700">About: </span>
            {aboutOpen || !showAboutToggle ? about : `${about.slice(0, 160).trim()}…`}
            {showAboutToggle ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onToggleAbout}
                  className="font-medium text-sky-700 hover:underline"
                >
                  {aboutOpen ? "Show less" : "Show more"}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function formatImportDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
