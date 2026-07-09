"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutList, Plus, X } from "lucide-react";
import type { CoachTableView } from "@/lib/admin/coachTableViews";

type Props = {
  views: CoachTableView[];
  activeViewId: string | null;
  onSwitchView: (viewId: string) => void;
  onAddView: (name: string) => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
};

export function CoachesTableViewBar({
  views,
  activeViewId,
  onSwitchView,
  onAddView,
  onRenameView,
  onDeleteView,
}: Props) {
  const [addingView, setAddingView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingView) addInputRef.current?.focus();
  }, [addingView]);

  useEffect(() => {
    if (renamingViewId) renameInputRef.current?.focus();
  }, [renamingViewId]);

  function submitNewView() {
    const trimmed = newViewName.trim();
    if (!trimmed) {
      setAddingView(false);
      setNewViewName("");
      return;
    }
    onAddView(trimmed);
    setAddingView(false);
    setNewViewName("");
  }

  function submitRename(viewId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameView(viewId, trimmed);
    setRenamingViewId(null);
    setRenameValue("");
  }

  return (
    <nav
      className="flex items-center gap-0 overflow-x-auto border-b border-slate-100 pb-0"
      aria-label="Saved table views"
    >
      {views.map((view, index) => {
        const active = view.id === activeViewId;
        const canDelete = views.length > 1;

        return (
          <div key={view.id} className="flex shrink-0 items-stretch">
            {index > 0 ? (
              <span
                className="mx-1 w-px self-stretch bg-slate-200"
                aria-hidden
              />
            ) : null}
            {renamingViewId === view.id ? (
              <form
                className="-mb-px flex items-center border-b-[3px] border-sky-600 pb-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRename(view.id);
                }}
              >
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(view.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setRenamingViewId(null);
                      setRenameValue("");
                    }
                  }}
                  className="w-32 rounded border border-slate-300 px-2 py-0.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  aria-label="Rename view"
                />
              </form>
            ) : (
              <div className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => onSwitchView(view.id)}
                  onDoubleClick={() => {
                    setRenamingViewId(view.id);
                    setRenameValue(view.name);
                  }}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-[3px] px-2 pb-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-slate-800 text-slate-900"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
                  }`}
                  title="Double-click to rename"
                >
                  <LayoutList className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="max-w-[12rem] truncate">{view.name}</span>
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => onDeleteView(view.id)}
                    className="absolute -right-1 top-0 rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                    aria-label={`Delete view ${view.name}`}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      <span className="mx-2 w-px self-stretch bg-slate-200" aria-hidden />

      {addingView ? (
        <form
          className="-mb-px flex items-center gap-1 border-b-[3px] border-transparent pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitNewView();
          }}
        >
          <input
            ref={addInputRef}
            type="text"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            onBlur={() => {
              if (!newViewName.trim()) {
                setAddingView(false);
                setNewViewName("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAddingView(false);
                setNewViewName("");
              }
            }}
            placeholder="View name"
            className="w-36 rounded border border-slate-300 px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            aria-label="New view name"
          />
          <button
            type="submit"
            className="rounded px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
          >
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddingView(true)}
          className="-mb-px inline-flex items-center gap-1 border-b-[3px] border-transparent px-2 pb-2 text-sm font-medium text-slate-500 transition-colors hover:border-slate-200 hover:text-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          View
        </button>
      )}
    </nav>
  );
}
