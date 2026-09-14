"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import {
  addCustomColumn,
  addCustomSection,
  deleteColumn,
  deleteSection,
  moveColumn,
  moveSection,
  renameColumn,
  renameSection,
  setAvgDealAmount,
  setColumnHidden,
  setSectionHidden,
  type PipelineLayout,
} from "@/lib/pipelineLayout";

type Props = {
  open: boolean;
  layout: PipelineLayout;
  onChange: (layout: PipelineLayout) => void;
  onClose: () => void;
};

export function PipelineCustomizePanel({
  open,
  layout,
  onChange,
  onClose,
}: Props) {
  const [avgDraft, setAvgDraft] = useState(String(layout.avgDealAmount));

  useEffect(() => {
    setAvgDraft(String(layout.avgDealAmount));
  }, [layout.avgDealAmount, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="Close customize pipeline"
        className="absolute inset-0 bg-slate-900/30"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Customize pipeline
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Columns, sections, and average deal value.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              Average deal
            </span>
            <span className="mt-1 flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              £
              <input
                type="text"
                inputMode="numeric"
                value={avgDraft}
                onChange={(e) => setAvgDraft(e.target.value)}
                onBlur={() => {
                  const n = Number(avgDraft.replace(/[^0-9.]/g, ""));
                  onChange(
                    setAvgDealAmount(
                      layout,
                      Number.isFinite(n) ? n : layout.avgDealAmount
                    )
                  );
                }}
                aria-label="Average deal amount in pounds"
                className="w-full border-0 bg-transparent p-0 outline-none"
              />
            </span>
            <span className="mt-1 block text-[11px] text-slate-400">
              Used to estimate column value from deal count.
            </span>
          </label>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Columns</h3>
            <button
              type="button"
              onClick={() => onChange(addCustomColumn(layout))}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Add column
            </button>
          </div>

          <ul className="mt-3 space-y-3">
            {layout.columns
              .filter((col) => col.id !== "leads")
              .map((col) => {
              const index = layout.columns.findIndex((item) => item.id === col.id);
              return (
                <li
                  key={col.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${col.label} up`}
                      disabled={index === 0}
                      onClick={() => onChange(moveColumn(layout, col.id, -1))}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${col.label} down`}
                      disabled={index === layout.columns.length - 1}
                      onClick={() => onChange(moveColumn(layout, col.id, 1))}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    value={col.label}
                    onChange={(e) =>
                      onChange(renameColumn(layout, col.id, e.target.value))
                    }
                    className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={!col.hidden}
                      onChange={(e) =>
                        onChange(
                          setColumnHidden(layout, col.id, !e.target.checked)
                        )
                      }
                    />
                    Show
                  </label>
                  {!col.system ? (
                    <button
                      type="button"
                      aria-label={`Delete ${col.label}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${col.label}”? Prospects in this column keep their status until you move them.`
                          )
                        ) {
                          onChange(deleteColumn(layout, col.id));
                        }
                      }}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 pl-8">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Sections
                    </p>
                    <button
                      type="button"
                      onClick={() => onChange(addCustomSection(layout, col.id))}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900"
                    >
                      <Plus className="h-3 w-3.5" />
                      Add
                    </button>
                  </div>
                  {col.sections.length === 0 ? (
                    <p className="mt-2 text-[11px] text-slate-400">
                      No sections — cards stack in one list.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {col.sections.map((section, sectionIndex) => (
                        <li
                          key={section.id}
                          className="flex items-center gap-1.5"
                        >
                          <div className="flex flex-col">
                            <button
                              type="button"
                              aria-label={`Move ${section.label} up`}
                              disabled={sectionIndex === 0}
                              onClick={() =>
                                onChange(
                                  moveSection(layout, col.id, section.id, -1)
                                )
                              }
                              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${section.label} down`}
                              disabled={sectionIndex === col.sections.length - 1}
                              onClick={() =>
                                onChange(
                                  moveSection(layout, col.id, section.id, 1)
                                )
                              }
                              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          <input
                            value={section.label}
                            onChange={(e) =>
                              onChange(
                                renameSection(
                                  layout,
                                  col.id,
                                  section.id,
                                  e.target.value
                                )
                              )
                            }
                            className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-sky-400"
                          />
                          <label className="flex items-center gap-1 text-[11px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={!section.hidden}
                              onChange={(e) =>
                                onChange(
                                  setSectionHidden(
                                    layout,
                                    col.id,
                                    section.id,
                                    !e.target.checked
                                  )
                                )
                              }
                            />
                            Show
                          </label>
                          <button
                            type="button"
                            aria-label={
                              section.system
                                ? `Hide ${section.label}`
                                : `Delete ${section.label}`
                            }
                            onClick={() => {
                              if (
                                section.system ||
                                window.confirm(`Delete “${section.label}”?`)
                              ) {
                                onChange(
                                  deleteSection(layout, col.id, section.id)
                                );
                              }
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
              })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
