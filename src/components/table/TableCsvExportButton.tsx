"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";

type Props = {
  disabled?: boolean;
  onExportShown: () => void;
  onExportAll: () => void;
};

export function TableCsvExportButton({
  disabled = false,
  onExportShown,
  onExportAll,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

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
          className="absolute left-0 z-[90] mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setMenuOpen(false);
              onExportShown();
            }}
          >
            Shown columns
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setMenuOpen(false);
              onExportAll();
            }}
          >
            All columns
          </button>
        </div>
      ) : null}
    </div>
  );
}
