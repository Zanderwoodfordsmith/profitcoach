"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Copy, Pencil, Trash2 } from "lucide-react";

type Props = {
  label: string;
  canRename?: boolean;
  canDelete?: boolean;
  canDuplicate?: boolean;
  disabled?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
};

const MENU_WIDTH = 160;

export function TabOverflowMenu({
  label,
  canRename = false,
  canDelete = false,
  canDuplicate = false,
  disabled = false,
  onRename,
  onDelete,
  onDuplicate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8
      );
      setPosition({ top: rect.bottom + 4, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canRename && !canDelete && !canDuplicate) return null;

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="fixed z-[220] w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {canDuplicate && onDuplicate ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onDuplicate();
                }}
              >
                <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                Duplicate
              </button>
            ) : null}
            {canRename && onRename ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onRename();
                }}
              >
                <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                Rename
              </button>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" aria-hidden />
                Delete
              </button>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${label} actions`}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
        className="rounded p-0.5 text-slate-400 opacity-80 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
      >
        <MoreVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
