"use client";

import type { RefObject } from "react";
import { Columns3, GripVertical } from "lucide-react";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import type { DataTableColumnOption } from "@/hooks/usePersistedColumnSettings";

type DataTableColumnsMenuProps<TKey extends string> = {
  open: boolean;
  onToggle: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  shownOptions: readonly DataTableColumnOption<TKey>[];
  hiddenOptions: readonly DataTableColumnOption<TKey>[];
  columnVisibility: Record<TKey, boolean>;
  onVisibilityChange: (key: TKey, visible: boolean) => void;
  onMoveColumn: (draggedKey: TKey, targetKey: TKey) => void;
  draggingColumnKey: TKey | null;
  onDraggingColumnKeyChange: (key: TKey | null) => void;
  /** Dropdown alignment. Default left. */
  align?: "left" | "right";
  triggerId?: string;
  menuId?: string;
};

export function DataTableColumnsMenu<TKey extends string>({
  open,
  onToggle,
  menuRef,
  shownOptions,
  hiddenOptions,
  columnVisibility,
  onVisibilityChange,
  onMoveColumn,
  draggingColumnKey,
  onDraggingColumnKeyChange,
  align = "left",
  triggerId,
  menuId,
}: DataTableColumnsMenuProps<TKey>) {
  function renderColumnRow(option: DataTableColumnOption<TKey>) {
    const { key, label } = option;
    return (
      <li
        key={key}
        role="none"
        draggable
        onDragStart={(e) => {
          onDraggingColumnKeyChange(key);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", key);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const droppedKey =
            (e.dataTransfer.getData("text/plain") as TKey) || draggingColumnKey;
          if (droppedKey) onMoveColumn(droppedKey, key);
          onDraggingColumnKeyChange(null);
        }}
        onDragEnd={() => onDraggingColumnKeyChange(null)}
        className={`rounded ${draggingColumnKey === key ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          <GripVertical
            className="h-3.5 w-3.5 text-slate-400"
            aria-hidden
          />
          <input
            type="checkbox"
            checked={columnVisibility[key]}
            onChange={(e) => onVisibilityChange(key, e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>{label}</span>
        </div>
      </li>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <TableToolbarButton
        label="Columns"
        id={triggerId}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        active={open}
        onClick={onToggle}
        icon={<Columns3 className="h-5 w-5 text-slate-500" aria-hidden />}
      />
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className={`absolute z-[90] mt-1 max-h-[min(24rem,70vh)] w-[min(100vw-2rem,18rem)] overflow-y-auto rounded-md border border-slate-200 bg-white py-2 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Shown
          </p>
          <ul className="space-y-0.5 px-2">
            {shownOptions.map(renderColumnRow)}
          </ul>
          <div className="my-2 border-t border-slate-200" />
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hidden
          </p>
          <ul className="space-y-0.5 px-2">
            {hiddenOptions.map(renderColumnRow)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
