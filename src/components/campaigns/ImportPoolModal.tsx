"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Loader2,
  MapPin,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { MAX_POOL_ITEMS_PER_REQUEST } from "@/lib/leadLists/audienceLists";
import { parseProspectsCsv } from "@/lib/prospects/parseProspectsCsv";
import { splitPersonName } from "@/lib/leadLists/audienceLists";
import { poolIdentityKey } from "@/lib/pool/identity";
import { isSalesNavSearchUrl } from "@/lib/salesNavigator/isSalesNavSearchUrl";
import {
  unwatchSalesNavImport,
  watchSalesNavImport,
} from "@/lib/salesNavigator/importJobWatch";
import {
  SALES_NAV_POOL_LIMIT_OPTIONS,
  type SalesNavPoolSizeValue,
} from "@/lib/salesNavigator/importSizing";
import {
  SALES_NAV_BASE_SEARCH_1ST_URL,
  SALES_NAV_BASE_SEARCH_URL,
} from "@/lib/salesNavigator/salesNavLinks";
import { GOOGLE_MAPS_SIZE_OPTIONS } from "@/lib/googleMaps/cost";

type Mode = "pick" | "search" | "maps" | "csv" | "one";
type ImportKind = "sales_nav" | "google_maps";
type SalesNavSource = "first" | "custom";

const SALES_NAV_IMPORT_SOURCES: Array<{
  id: SalesNavSource;
  title: string;
  body: string;
  url: string | null;
}> = [
  {
    id: "first",
    title: "1st degree",
    body: "Classroom filters, your connections only.",
    url: SALES_NAV_BASE_SEARCH_1ST_URL,
  },
  {
    id: "custom",
    title: "Custom URL",
    body: "Paste a people-search link after you adjust filters.",
    url: null,
  },
];

const MODE_TITLES: Record<Mode, string> = {
  pick: "Import into pool",
  search: "Sales Navigator import",
  maps: "Google Maps",
  csv: "Upload CSV",
  one: "Add one person",
};

type ImportProgress = {
  progressCount: number;
  targetCount: number;
  phase: "scraping" | "finalizing";
  segmentLabel: string | null;
  segmentIndex: number;
  segmentTotal: number;
};

const UNIPILE_POLL_MS = 2_000;

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
  onImportStarted?: (info: {
    jobId: string;
    saveListId: string;
    saveListName: string;
    targetCount: number;
    kind: ImportKind;
  }) => void;
};

const OPTIONS: Array<{
  id: Exclude<Mode, "pick">;
  title: string;
  body: string;
  icon: typeof Search;
}> = [
  {
    id: "one",
    title: "Add one person",
    body: "Name plus email, phone, or LinkedIn. LinkedIn is optional.",
    icon: UserPlus,
  },
  {
    id: "search",
    title: "Sales Navigator",
    body: "Open the base search, then import 1st degree or a custom URL.",
    icon: Search,
  },
  {
    id: "maps",
    title: "Google Maps",
    body: "Search a trade and city. We add the business and contacts.",
    icon: MapPin,
  },
  {
    id: "csv",
    title: "Upload CSV",
    body: "Name, company, email, phone, or LinkedIn.",
    icon: FileSpreadsheet,
  },
];

export function ImportPoolModal({
  open,
  onClose,
  onImported,
  onImportStarted,
}: Props) {
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onImportedRef = useRef(onImported);
  onImportedRef.current = onImported;
  const onImportStartedRef = useRef(onImportStarted);
  onImportStartedRef.current = onImportStarted;
  const [mode, setMode] = useState<Mode>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchUrl, setSearchUrl] = useState("");
  const [salesNavSource, setSalesNavSource] = useState<SalesNavSource | null>(
    null
  );
  const [poolSize, setPoolSize] = useState<SalesNavPoolSizeValue>(100);
  const pendingSaveListNameRef = useRef<string | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importKind, setImportKind] = useState<ImportKind>("sales_nav");
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null
  );

  const [mapsTerm, setMapsTerm] = useState("");
  const [mapsLocation, setMapsLocation] = useState("");
  const [mapsMaxPlaces, setMapsMaxPlaces] = useState(100);

  const salesNavCapRef = useRef(0);
  const [pasteText, setPasteText] = useState("");
  const [showPasteLinks, setShowPasteLinks] = useState(false);
  const [oneUrl, setOneUrl] = useState("");
  const [oneName, setOneName] = useState("");
  const [oneTitle, setOneTitle] = useState("");
  const [oneCompany, setOneCompany] = useState("");
  const [oneEmail, setOneEmail] = useState("");
  const [onePhone, setOnePhone] = useState("");

  useEffect(() => {
    if (!importJobId) return;
    const jobId = importJobId;
    let cancelled = false;

    async function poll() {
      const headers = await getCoachAuthHeaders();
      if (!headers) return;
      if (cancelled) return;
      const path =
        importKind === "google_maps"
          ? `/api/coach/google-maps-import/${jobId}`
          : `/api/coach/sales-nav-import/${jobId}`;
      let res = await fetch(path, { headers });
      if (res.status === 401) {
        const retryHeaders = await getCoachAuthHeaders();
        if (!retryHeaders) return;
        res = await fetch(path, { headers: retryHeaders });
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        progressCount?: number;
        targetCount?: number;
        scrapedCount?: number;
        added?: number;
        peopleFound?: number;
        phase?: "scraping" | "finalizing" | null;
        run?: {
          segmentLabel?: string | null;
          segmentIndex?: number;
          segmentTotal?: number;
        };
      };
      if (cancelled) return;
      if (!res.ok) {
        // Stale JWT or a sync blip — keep polling; do not kill a running job.
        if (res.status === 401 || res.status === 502) return;
        setError(body.error || "Import failed.");
        setBusy(false);
        setImportJobId(null);
        unwatchSalesNavImport(jobId);
        return;
      }

      const cap = importKind === "sales_nav" ? salesNavCapRef.current : 0;
      const targetCount =
        cap > 0 ? cap : Math.max(0, body.targetCount ?? 0);
      const progressCount = Math.max(
        0,
        body.progressCount ?? body.scrapedCount ?? 0
      );
      setImportProgress({
        progressCount,
        targetCount,
        phase: body.phase === "finalizing" ? "finalizing" : "scraping",
        segmentLabel: body.run?.segmentLabel ?? null,
        segmentIndex: body.run?.segmentIndex ?? 0,
        segmentTotal: body.run?.segmentTotal ?? 1,
      });

      if (body.status === "succeeded") {
        unwatchSalesNavImport(jobId);
        setImportJobId(null);
        setBusy(false);
        const added = Math.max(0, body.added ?? progressCount);
        const peopleFound = Math.max(0, body.peopleFound ?? 0);
        const savedAs = pendingSaveListNameRef.current
          ? ` Also saved as “${pendingSaveListNameRef.current}”.`
          : "";
        pendingSaveListNameRef.current = null;
        setNotice(
          importKind === "google_maps"
            ? `Added ${added.toLocaleString()} ${
                added === 1 ? "business" : "businesses"
              } to the pool${
                peopleFound
                  ? ` · ${peopleFound.toLocaleString()} ${
                      peopleFound === 1 ? "person" : "people"
                    } found`
                  : ""
              }.${savedAs}`
            : `Added ${progressCount.toLocaleString()} ${
                progressCount === 1 ? "person" : "people"
              } to the pool.${savedAs}`
        );
        await onImportedRef.current();
        return;
      }
      if (body.status === "failed") {
        unwatchSalesNavImport(jobId);
        setImportJobId(null);
        setBusy(false);
        setError(body.error || "Import failed.");
      }
    }

    void poll();
    const handle = window.setInterval(() => void poll(), UNIPILE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [importJobId, importKind]);

  if (!open) return null;

  function reset() {
    setMode("pick");
    setBusy(false);
    setError(null);
    setNotice(null);
    setSearchUrl("");
    setSalesNavSource(null);
    setPoolSize(100);
    pendingSaveListNameRef.current = null;
    setImportJobId(null);
    setImportKind("sales_nav");
    setImportProgress(null);
    setMapsTerm("");
    setMapsLocation("");
    setMapsMaxPlaces(100);
    setPasteText("");
    setShowPasteLinks(false);
    setOneUrl("");
    setOneName("");
    setOneTitle("");
    setOneCompany("");
    setOneEmail("");
    setOnePhone("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  async function startSalesNavImport() {
    const url = searchUrl.trim();
    if (!isSalesNavSearchUrl(url)) {
      setError(
        "Paste a Sales Navigator people-search URL (linkedin.com/sales/search/people…)."
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setImportProgress(null);
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const cap = poolSize === "all" ? 0 : poolSize;
      salesNavCapRef.current = cap;
      const res = await fetch("/api/coach/sales-nav-import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          salesNavUrl: url,
          name: "Pool import",
          ...(cap ? { poolLimit: cap } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        jobId?: string;
        targetCount?: number;
        segmented?: boolean;
        segmentTotal?: number;
        segmentLabels?: string[];
        saveListId?: string | null;
        saveListName?: string | null;
      };
      if (!res.ok) throw new Error(body.error || "Import failed.");
      if (!body.jobId) throw new Error("Import started but no job id was returned.");
      if (!body.saveListId) {
        throw new Error("Import started but no list was created.");
      }
      const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
      const saveListName = body.saveListName?.trim() || "Sales Nav import";
      pendingSaveListNameRef.current = saveListName;
      watchSalesNavImport({
        id: body.jobId,
        name: saveListName,
        targetCount: body.targetCount,
        resumeHref: `${prefix}/campaigns?tab=pool`,
        saveListId: body.saveListId,
        kind: "sales_nav",
      });
      onImportStartedRef.current?.({
        jobId: body.jobId,
        saveListId: body.saveListId,
        saveListName,
        targetCount: body.targetCount ?? cap,
        kind: "sales_nav",
      });
      setBusy(false);
      setMode("pick");
      setSalesNavSource(null);
      setImportProgress(null);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  async function startMapsImport() {
    const searchTerm = mapsTerm.trim();
    const location = mapsLocation.trim();
    if (searchTerm.length < 2 || location.length < 2) {
      setError("Enter a search and a city or area.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setImportProgress(null);
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/google-maps-import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          searchTerm,
          location,
          maxPlaces: mapsMaxPlaces,
          findPeople: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        jobId?: string;
        targetCount?: number;
        saveListId?: string | null;
        saveListName?: string | null;
      };
      if (!res.ok) throw new Error(body.error || "Import failed.");
      if (!body.jobId) throw new Error("Import started but no job id was returned.");
      if (!body.saveListId) {
        throw new Error("Import started but no list was created.");
      }
      const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
      const saveListName = body.saveListName?.trim() || "Google Maps import";
      pendingSaveListNameRef.current = saveListName;
      watchSalesNavImport({
        id: body.jobId,
        name: saveListName,
        targetCount: body.targetCount ?? mapsMaxPlaces,
        resumeHref: `${prefix}/campaigns?tab=pool`,
        saveListId: body.saveListId,
        kind: "google_maps",
      });
      onImportStartedRef.current?.({
        jobId: body.jobId,
        saveListId: body.saveListId,
        saveListName,
        targetCount: body.targetCount ?? mapsMaxPlaces,
        kind: "google_maps",
      });
      setBusy(false);
      setMode("pick");
      setImportProgress(null);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  async function importPeople(input: {
    people?: unknown;
    text?: string;
    source?: string;
  }) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/pool", {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        added?: number;
        skipped?: number;
        blacklisted?: number;
        invalid?: number;
      };
      if (!res.ok) throw new Error(body.error || "Could not import.");
      const added = Number(body.added ?? 0);
      const skipped = Number(body.skipped ?? 0);
      const blocked = Number(body.blacklisted ?? 0);
      const invalid = Number(body.invalid ?? 0);
      const parts = [
        added ? `${added} new` : null,
        skipped ? `${skipped} already in the pool` : null,
        blocked ? `${blocked} blacklisted` : null,
        invalid
          ? `${invalid} skipped (need email, phone, LinkedIn, or website)`
          : null,
      ].filter(Boolean);
      setNotice(parts.join(" · ") || "Nothing new to add.");
      if (added > 0) await onImported();
      if (input.text) setPasteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import.");
    } finally {
      setBusy(false);
    }
  }

  function onCsvFile(file: File | undefined) {
    setError(null);
    setNotice(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseProspectsCsv(String(reader.result ?? ""), {
          maxRows: MAX_POOL_ITEMS_PER_REQUEST,
        });
        const people = rows.map((row) => {
          const { first_name, last_name } = splitPersonName(row.fullName);
          return {
            linkedin_url: row.linkedinUrl,
            first_name,
            last_name,
            company: row.businessName,
            title: row.jobTitle,
            email: row.email,
            phone: row.phone,
          };
        });
        if (!people.length) {
          setError("That CSV has no people to add.");
          return;
        }
        void importPeople({ people, source: "manual" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read CSV.");
      }
    };
    reader.readAsText(file);
  }

  const oneReady =
    Boolean(oneName.trim()) &&
    Boolean(
      poolIdentityKey({
        linkedin_url: oneUrl,
        email: oneEmail,
        phone: onePhone,
      })
    );

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16 sm:pt-24">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            {mode !== "pick" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("pick");
                  setError(null);
                  setSalesNavSource(null);
                }}
                disabled={Boolean(importJobId)}
                className="mb-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                ← All import options
              </button>
            ) : null}
            <h2 className="text-base font-semibold text-slate-900">
              {MODE_TITLES[mode]}
            </h2>
            {mode === "pick" ? (
              <p className="mt-0.5 text-xs text-slate-600">
                People you already have stay one row. Overlap does not grow the
                pool.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close import"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {notice ? <p className="text-sm text-slate-700">{notice}</p> : null}

          {mode === "pick" ? (
            <div className="flex flex-col gap-2">
              {OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setMode(option.id);
                    }}
                    className="flex w-full items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0c5290]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                        {option.body}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          ) : null}

          {mode === "search" ? (
            <div className="space-y-3">
              {importProgress && importKind === "sales_nav" ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-amber-950">
                    <Loader2
                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                      aria-hidden
                    />
                    <span className="font-semibold">
                      {importProgress.phase === "finalizing"
                        ? "Finishing import"
                        : "Importing into pool"}
                    </span>
                    <span className="tabular-nums text-amber-900/80">
                      {importProgress.phase === "finalizing"
                        ? `${importProgress.progressCount.toLocaleString()} people`
                        : importProgress.targetCount > 0
                          ? `${importProgress.progressCount.toLocaleString()} / ${importProgress.targetCount.toLocaleString()}`
                          : `${importProgress.progressCount.toLocaleString()} people`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-amber-200/80">
                    {importProgress.targetCount > 0 ? (
                      <div
                        className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
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
                    ) : (
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-500" />
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-snug text-amber-900/80">
                    You can close this and keep working. Progress stays on the
                    pool page.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <a
                  href={SALES_NAV_BASE_SEARCH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (!importJobId) {
                      setError(null);
                      setSalesNavSource("custom");
                      setSearchUrl("");
                    }
                  }}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">
                      Base search
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                      Opens Sales Navigator so you can set geography and refine
                      filters. Then paste the URL under Custom.
                    </span>
                  </span>
                  <span
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#0c5290]"
                    aria-hidden
                  >
                    <ExternalLink className="h-4 w-4" />
                  </span>
                </a>

                {SALES_NAV_IMPORT_SOURCES.map((source) => {
                  const selected = salesNavSource === source.id;
                  return (
                    <div
                      key={source.id}
                      className={`flex items-start gap-1 rounded-xl border transition-colors ${
                        selected
                          ? "border-[#0c5290] bg-sky-50/70"
                          : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={Boolean(importJobId)}
                        onClick={() => {
                          setError(null);
                          setSalesNavSource(source.id);
                          if (source.url) setSearchUrl(source.url);
                          else if (!searchUrl.trim()) setSearchUrl("");
                        }}
                        className="flex min-w-0 flex-1 items-start gap-3 px-3.5 py-3 text-left disabled:opacity-50"
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-[#0c5290] bg-[#0c5290]"
                              : "border-slate-300 bg-white"
                          }`}
                          aria-hidden
                        >
                          {selected ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {source.title}
                          </span>
                          <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                            {source.body}
                          </span>
                        </span>
                      </button>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Preview in Sales Navigator"
                          aria-label="Preview in Sales Navigator"
                          className="mt-2 mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#0c5290] hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {salesNavSource === "custom" ? (
                <div className="space-y-2">
                  <textarea
                    value={searchUrl}
                    onChange={(e) => setSearchUrl(e.target.value)}
                    rows={3}
                    placeholder="https://www.linkedin.com/sales/search/people?query=…"
                    className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-xs"
                    spellCheck={false}
                    disabled={Boolean(importJobId)}
                  />
                  {searchUrl.trim() &&
                  !isSalesNavSearchUrl(searchUrl.trim()) ? (
                    <p className="text-xs text-rose-600">
                      Needs a Sales Navigator people-search URL.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {salesNavSource ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <span className="whitespace-nowrap text-slate-500">
                      Import size
                    </span>
                    <select
                      value={poolSize === "all" ? "all" : String(poolSize)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") setPoolSize("all");
                        else
                          setPoolSize(
                            Number(v) as (typeof SALES_NAV_POOL_LIMIT_OPTIONS)[number]
                          );
                      }}
                      disabled={Boolean(importJobId)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                    >
                      <option value="100">100</option>
                      {SALES_NAV_POOL_LIMIT_OPTIONS.filter((n) => n !== 100).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n.toLocaleString()}
                          </option>
                        )
                      )}
                      <option value="all">All available</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      Boolean(importJobId) ||
                      !isSalesNavSearchUrl(searchUrl.trim())
                    }
                    onClick={() => void startSalesNavImport()}
                    className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {importJobId ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      "Import to pool"
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "maps" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  Search
                </span>
                <input
                  value={mapsTerm}
                  onChange={(e) => setMapsTerm(e.target.value)}
                  placeholder="Plumbers, dental practices, gyms…"
                  disabled={Boolean(importJobId)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  City or area
                </span>
                <input
                  value={mapsLocation}
                  onChange={(e) => setMapsLocation(e.target.value)}
                  placeholder="Manchester, UK"
                  disabled={Boolean(importJobId)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  Up to
                </span>
                <select
                  value={mapsMaxPlaces}
                  onChange={(e) => setMapsMaxPlaces(Number(e.target.value))}
                  disabled={Boolean(importJobId)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                >
                  {GOOGLE_MAPS_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size.toLocaleString()} businesses
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={
                  busy ||
                  Boolean(importJobId) ||
                  mapsTerm.trim().length < 2 ||
                  mapsLocation.trim().length < 2
                }
                onClick={() => void startMapsImport()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {importJobId && importKind === "google_maps" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Import to pool"
                )}
              </button>
              {importProgress && importKind === "google_maps" ? (
                <div>
                  <div className="mb-1.5 flex justify-between gap-3 text-xs text-slate-500">
                    <span>
                      {importProgress.progressCount.toLocaleString()} /{" "}
                      {importProgress.targetCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#0c5290] transition-[width] duration-500"
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
          ) : null}

          {mode === "csv" ? (
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-slate-700"
                onChange={(e) => onCsvFile(e.target.files?.[0])}
              />
              <p className="text-xs text-slate-600">
                Needs a Name column. Rows need an email, phone, or LinkedIn URL
                so we can keep one row per person.
              </p>
            </div>
          ) : null}

          {mode === "one" ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Name
                  </span>
                  <input
                    value={oneName}
                    onChange={(e) => setOneName(e.target.value)}
                    placeholder="Jane Example"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Company
                  </span>
                  <input
                    value={oneCompany}
                    onChange={(e) => setOneCompany(e.target.value)}
                    placeholder="Example Ltd"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Title
                  </span>
                  <input
                    value={oneTitle}
                    onChange={(e) => setOneTitle(e.target.value)}
                    placeholder="Founder"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Email
                  </span>
                  <input
                    type="email"
                    value={oneEmail}
                    onChange={(e) => setOneEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={onePhone}
                    onChange={(e) => setOnePhone(e.target.value)}
                    placeholder="+44 7700 900000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    LinkedIn
                  </span>
                  <input
                    value={oneUrl}
                    onChange={(e) => setOneUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/…"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <p className="text-xs leading-snug text-slate-600 sm:col-span-2">
                  Need an email, phone, or personal LinkedIn URL so this person
                  stays one row.
                </p>
                <button
                  type="button"
                  disabled={busy || !oneReady}
                  onClick={() => {
                    const { first_name, last_name } = splitPersonName(oneName);
                    void importPeople({
                      people: [
                        {
                          linkedin_url: oneUrl || null,
                          first_name,
                          last_name,
                          company: oneCompany || null,
                          title: oneTitle || null,
                          email: oneEmail || null,
                          phone: onePhone || null,
                        },
                      ],
                    });
                  }}
                  className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2"
                >
                  Add person
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasteLinks((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden />
                  {showPasteLinks
                    ? "Hide LinkedIn link paste"
                    : "Paste several LinkedIn links"}
                </button>
                {showPasteLinks ? (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={5}
                      placeholder="One LinkedIn URL per line. Optional: url, first, last, company, title"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy || !pasteText.trim()}
                      onClick={() => void importPeople({ text: pasteText })}
                      className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Add links
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
