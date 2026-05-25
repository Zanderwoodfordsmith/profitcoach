"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";

export type CsvExportScope = "selected" | "matching";

type Props = {
  disabled?: boolean;
  /** When greater than zero, the export menu asks selected vs all matching. */
  selectedCount?: number;
  totalMatchingCount?: number;
  onExportShown: (scope: CsvExportScope) => void;
  onExportAll: (scope: CsvExportScope) => void;
};

export function TableCsvExportButton({
  disabled = false,
  selectedCount = 0,
  totalMatchingCount = 0,
  onExportShown,
  onExportAll,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportScope, setExportScope] = useState<CsvExportScope>("selected");
  const menuRef = useRef<HTMLDivElement | null>(null);

  const showScopeChoice = selectedCount > 0;

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && showScopeChoice) {
      setExportScope("selected");
    }
  }, [menuOpen, showScopeChoice]);

  function runExport(exportColumns: "shown" | "all") {
    const scope: CsvExportScope = showScopeChoice ? exportScope : "matching";
    setMenuOpen(false);
    if (exportColumns === "shown") {
      onExportShown(scope);
    } else {
      onExportAll(scope);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <TableToolbarButton
        label="Export"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        active={menuOpen}
        disabled={disabled}
        onClick={() => setMenuOpen((open) => !open)}
        icon={<Download className="h-5 w-5 text-slate-500" aria-hidden />}
      />
      {menuOpen ? (
        <div
          role="menu"
          className="absolute left-0 z-[90] mt-1 w-60 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {showScopeChoice ? (
            <div className="border-b border-slate-100 px-3 py-2.5">
              <p className="mb-2 text-xs font-medium text-slate-600">
                Which prospects should be exported?
              </p>
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="csv-export-scope"
                    value="selected"
                    checked={exportScope === "selected"}
                    onChange={() => setExportScope("selected")}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm text-slate-700">
                    Selected ({selectedCount})
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="csv-export-scope"
                    value="matching"
                    checked={exportScope === "matching"}
                    onChange={() => setExportScope("matching")}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm text-slate-700">
                    All matching ({totalMatchingCount})
                  </span>
                </label>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => runExport("shown")}
          >
            Shown columns
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => runExport("all")}
          >
            All columns
          </button>
        </div>
      ) : null}
    </div>
  );
}
