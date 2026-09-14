"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { MAX_PROSPECT_IMPORT_ROWS } from "@/lib/prospects/importLimits";
import {
  parseProspectsCsv,
  PROSPECTS_CSV_TEMPLATE,
  type ParsedProspectCsvRow,
} from "@/lib/prospects/parseProspectsCsv";
import type { ProspectRow } from "@/lib/prospectRow";

type CoachOption = { id: string; label: string };

type ImportResult = {
  created: number;
  updated: number;
  failed: Array<{ index: number; name: string; error: string }>;
  prospects: ProspectRow[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  coachOptions?: CoachOption[];
  requireCoach?: boolean;
  importUrl: string;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
  onImported: (prospects: ProspectRow[]) => void;
};

export function ImportProspectsModal({
  open,
  onClose,
  coachOptions = [],
  requireCoach = false,
  importUrl,
  extraHeaders = {},
  extraBody = {},
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [coachId, setCoachId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedProspectCsvRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  function reset() {
    setCoachId("");
    setFileName(null);
    setRows(null);
    setParseError(null);
    setImporting(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  function onFile(file: File | undefined) {
    setResult(null);
    setParseError(null);
    setRows(null);
    setFileName(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please choose a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed = parseProspectsCsv(text);
        setFileName(file.name);
        setRows(parsed);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Unable to read that CSV.");
      }
    };
    reader.onerror = () => setParseError("Unable to read that file.");
    reader.readAsText(file);
  }

  async function runImport() {
    if (!rows?.length) return;
    if (requireCoach && !coachId) {
      setParseError("Please select a coach for this import.");
      return;
    }
    setImporting(true);
    setParseError(null);
    try {
      const { getCoachAuthHeaders } = await import("@/lib/coachAuthHeaders");
      const headers = await getCoachAuthHeaders();
      if (!headers) {
        throw new Error("You must be signed in to import prospects.");
      }
      const res = await fetch(importUrl, {
        method: "POST",
        headers: {
          ...headers,
          ...extraHeaders,
        },
        body: JSON.stringify({
          ...extraBody,
          ...(requireCoach ? { coachId } : {}),
          rows,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as ImportResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to import prospects.");
      }
      setResult(body);
      if (body.prospects?.length) onImported(body.prospects);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Unable to import prospects.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([PROSPECTS_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prospects-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close import"
        className="absolute inset-0 bg-slate-900/30"
        onClick={close}
      />
      <div
        role="dialog"
        aria-labelledby="import-prospects-title"
        className="relative z-[81] w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="import-prospects-title" className="text-base font-semibold text-slate-900">
              Import prospects
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload a CSV with Name, Email, Phone, Business, Title, and LinkedIn.
              Up to {MAX_PROSPECT_IMPORT_ROWS} rows.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {requireCoach ? (
          <label className="mt-4 block text-xs font-medium text-slate-600">
            Coach
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
            >
              <option value="">Select a coach</option>
              {coachOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4 text-slate-500" aria-hidden />
            Choose CSV
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-sm font-medium text-sky-700 hover:text-sky-900"
          >
            Download template
          </button>
        </div>

        {fileName && rows ? (
          <p className="mt-3 text-sm text-slate-600">
            {fileName}: {rows.length} prospect{rows.length === 1 ? "" : "s"} ready.
          </p>
        ) : null}
        {parseError ? <p className="mt-3 text-sm text-rose-600">{parseError}</p> : null}

        {result ? (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Imported {result.created} new
            {result.updated > 0 ? `, updated ${result.updated} existing` : ""}.
            {result.failed.length > 0
              ? ` ${result.failed.length} row${result.failed.length === 1 ? "" : "s"} skipped.`
              : ""}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result ? (
            <button
              type="button"
              disabled={!rows?.length || importing || (requireCoach && !coachId)}
              onClick={() => void runImport()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Import
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
