"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import {
  CAMPAIGN_LIBRARY_KIND_LABEL,
  CAMPAIGN_LIBRARY_KINDS,
  CAMPAIGN_LIBRARY_TYPE_LABEL,
  type CampaignLibraryItemType,
  type CampaignLibraryKind,
} from "@/lib/campaignLibrary/types";

export function CampaignLibraryCreateDialog({
  open,
  itemType,
  name,
  kind,
  busy,
  onClose,
  onNameChange,
  onKindChange,
  onSubmit,
}: {
  open: boolean;
  itemType: CampaignLibraryItemType;
  name: string;
  kind: CampaignLibraryKind;
  busy: boolean;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onKindChange: (kind: CampaignLibraryKind) => void;
  onSubmit: () => void;
}) {
  const titleId = useId();
  const noun = CAMPAIGN_LIBRARY_TYPE_LABEL[itemType].toLowerCase();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            New {noun}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              autoFocus
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={`Untitled ${noun}`}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/30"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Kind
            <select
              value={kind}
              onChange={(e) =>
                onKindChange(e.target.value as CampaignLibraryKind)
              }
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/30"
            >
              {CAMPAIGN_LIBRARY_KINDS.map((value) => (
                <option key={value} value={value}>
                  {CAMPAIGN_LIBRARY_KIND_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#0c5290] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a4578] disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
