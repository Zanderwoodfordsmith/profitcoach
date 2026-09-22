"use client";

import { useRef, useState, type DragEvent } from "react";
import { Download, UploadCloud } from "lucide-react";
import {
  parseProspectsCsv,
  PROSPECTS_CSV_TEMPLATE,
  type ParsedProspectCsvRow,
} from "@/lib/prospects/parseProspectsCsv";

export function downloadProspectsCsvTemplate() {
  const blob = new Blob([PROSPECTS_CSV_TEMPLATE], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prospects-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  onRows: (rows: ParsedProspectCsvRow[], fileName: string) => void;
  maxRows?: number;
  disabled?: boolean;
  /** Channel-specific requirement, shown under the shared column guidance. */
  requirementNote?: string;
};

/**
 * Drag-and-drop CSV picker with template download and required-field
 * guidance. Parses the file with parseProspectsCsv and hands rows to the
 * parent; parse errors are shown inline.
 */
export function CsvUploadDropzone({
  onRows,
  maxRows,
  disabled = false,
  requirementNote,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file || disabled) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseProspectsCsv(
          String(reader.result ?? ""),
          maxRows ? { maxRows } : undefined
        );
        onRows(rows, file.name);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not read that CSV."
        );
      }
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a CSV file"
        onClick={() => {
          if (!disabled) fileRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 ${
          dragging
            ? "border-[#0c5290] bg-sky-50"
            : "border-slate-300 bg-slate-50/60 hover:border-sky-400 hover:bg-sky-50/50"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-[#0c5290]">
          <UploadCloud className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-slate-900">
          {dragging ? "Drop your CSV here" : "Drag and drop your CSV here"}
        </span>
        <span className="text-xs text-slate-600">
          or{" "}
          <span className="font-semibold text-[#0c5290] underline underline-offset-2">
            browse files
          </span>
        </span>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="rounded-lg bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
        <p>
          <span className="font-semibold text-slate-900">Name</span> is the only
          required column (or First name / Last name). Each row also needs at
          least one of{" "}
          <span className="font-semibold text-slate-900">email</span>,{" "}
          <span className="font-semibold text-slate-900">phone</span>, or{" "}
          <span className="font-semibold text-slate-900">LinkedIn URL</span> so
          each person stays one row. Title and Business are optional.
        </p>
        {requirementNote ? (
          <p className="mt-1.5 text-amber-800">{requirementNote}</p>
        ) : null}
        <button
          type="button"
          onClick={downloadProspectsCsvTemplate}
          className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#0c5290] hover:underline"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Download CSV template
        </button>
      </div>
    </div>
  );
}
