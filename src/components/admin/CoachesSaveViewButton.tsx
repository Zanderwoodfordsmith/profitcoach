"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  LayoutList,
  Lock,
  RotateCcw,
  Save,
  SquarePlus,
  ToggleLeft,
  ToggleRight,
  Upload,
  Users,
} from "lucide-react";

type Props = {
  isDirty: boolean;
  autosave: boolean;
  canEditActiveView: boolean;
  /** True when the active tab is the shared All view. */
  activeViewIsAll?: boolean;
  /** Current settings differ from the shared All view. */
  canUpdateAllView?: boolean;
  activeViewIsPrivate: boolean;
  error?: string | null;
  onSave: () => void;
  onUpdateAll?: () => void;
  onToggleAutosave: () => void;
  onSaveAsNew: (name: string, isPrivate: boolean) => void;
  onRevert: () => void;
  onTogglePrivacy?: (isPrivate: boolean) => void;
  onExportViews?: () => void;
  onImportViews?: (file: File) => void;
};

function SaveViewMenuItem({
  icon,
  label,
  shortcut,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="inline-flex w-4 shrink-0 justify-center text-slate-500">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut ? (
        <span className="text-xs text-slate-400">{shortcut}</span>
      ) : null}
    </button>
  );
}

export function CoachesSaveViewButton({
  isDirty,
  autosave,
  canEditActiveView,
  activeViewIsAll = false,
  canUpdateAllView = false,
  activeViewIsPrivate,
  error = null,
  onSave,
  onUpdateAll,
  onToggleAutosave,
  onSaveAsNew,
  onRevert,
  onTogglePrivacy,
  onExportViews,
  onImportViews,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveAsNewOpen, setSaveAsNewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewPrivate, setNewViewPrivate] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const saveAsNewInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSaveAsNewOpen(false);
        setNewViewName("");
        setNewViewPrivate(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (saveAsNewOpen) saveAsNewInputRef.current?.focus();
  }, [saveAsNewOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (canEditActiveView) onSave();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canEditActiveView, onSave]);

  const showDirty = isDirty && !autosave;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
          error
            ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
            : showDirty
              ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        Save view
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-[90] mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {error ? (
            <p className="border-b border-red-100 px-2.5 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
          <SaveViewMenuItem
            icon={<Save className="h-4 w-4" aria-hidden />}
            label={
              !canEditActiveView
                ? "Save view (read-only)"
                : activeViewIsAll
                  ? "Save All view"
                  : "Save view"
            }
            shortcut="⌘S"
            disabled={!canEditActiveView || (!isDirty && !autosave)}
            onClick={() => {
              onSave();
              setMenuOpen(false);
            }}
          />
          {onUpdateAll && !activeViewIsAll ? (
            <SaveViewMenuItem
              icon={<LayoutList className="h-4 w-4" aria-hidden />}
              label="Save settings to All"
              disabled={!canUpdateAllView}
              onClick={() => {
                onUpdateAll();
                setMenuOpen(false);
              }}
            />
          ) : null}
          <SaveViewMenuItem
            icon={
              autosave ? (
                <ToggleRight className="h-4 w-4 text-sky-600" aria-hidden />
              ) : (
                <ToggleLeft className="h-4 w-4" aria-hidden />
              )
            }
            label={autosave ? "Autosave on" : "Enable autosave"}
            disabled={!canEditActiveView}
            onClick={() => {
              onToggleAutosave();
            }}
          />
          {onTogglePrivacy && canEditActiveView ? (
            <SaveViewMenuItem
              icon={
                activeViewIsPrivate ? (
                  <Lock className="h-4 w-4" aria-hidden />
                ) : (
                  <Users className="h-4 w-4" aria-hidden />
                )
              }
              label={
                activeViewIsPrivate
                  ? "Make shared with admins"
                  : "Make private to me"
              }
              onClick={() => {
                onTogglePrivacy(!activeViewIsPrivate);
                setMenuOpen(false);
              }}
            />
          ) : null}
          {saveAsNewOpen ? (
            <form
              className="border-t border-slate-100 px-2 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newViewName.trim();
                if (trimmed) {
                  onSaveAsNew(trimmed, newViewPrivate);
                  setMenuOpen(false);
                  setSaveAsNewOpen(false);
                  setNewViewName("");
                  setNewViewPrivate(false);
                }
              }}
            >
              <input
                ref={saveAsNewInputRef}
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="New view name"
                className="block w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                aria-label="New view name"
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={newViewPrivate}
                  onChange={(e) => setNewViewPrivate(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Private (only me)
              </label>
            </form>
          ) : (
            <SaveViewMenuItem
              icon={<SquarePlus className="h-4 w-4" aria-hidden />}
              label="Save as new view"
              onClick={() => setSaveAsNewOpen(true)}
            />
          )}
          <div className="my-1 border-t border-slate-100" role="separator" />
          <SaveViewMenuItem
            icon={<RotateCcw className="h-4 w-4" aria-hidden />}
            label="Revert changes"
            disabled={!isDirty}
            onClick={() => {
              onRevert();
              setMenuOpen(false);
            }}
          />
          {onExportViews || onImportViews ? (
            <>
              <div className="my-1 border-t border-slate-100" role="separator" />
              {onExportViews ? (
                <SaveViewMenuItem
                  icon={<Download className="h-4 w-4" aria-hidden />}
                  label="Export views"
                  onClick={() => {
                    onExportViews();
                    setMenuOpen(false);
                  }}
                />
              ) : null}
              {onImportViews ? (
                <>
                  <SaveViewMenuItem
                    icon={<Upload className="h-4 w-4" aria-hidden />}
                    label="Import views"
                    onClick={() => importInputRef.current?.click()}
                  />
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onImportViews(file);
                        setMenuOpen(false);
                      }
                      e.target.value = "";
                    }}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
