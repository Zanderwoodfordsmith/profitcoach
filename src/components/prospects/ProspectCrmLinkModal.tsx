"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { ProspectRow } from "@/lib/prospectRow";

type Props = {
  prospect: ProspectRow | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (crmContactId: string) => void | Promise<void>;
};

export function ProspectCrmLinkModal({
  prospect,
  saving = false,
  onClose,
  onSave,
}: Props) {
  const [crmContactId, setCrmContactId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prospect) return;
    setCrmContactId(prospect.crm_contact_id ?? "");
    setError(null);
  }, [prospect]);

  useEffect(() => {
    if (!prospect) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [prospect, saving, onClose]);

  if (!prospect) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = crmContactId.trim();
    if (!trimmed) {
      setError("Enter a CRM contact ID.");
      return;
    }

    try {
      await onSave(trimmed);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save CRM contact ID."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prospect-crm-link-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="prospect-crm-link-title"
              className="text-lg font-semibold text-slate-900"
            >
              Link to CRM
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{prospect.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4">
          <label
            htmlFor="prospect-crm-contact-id"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            CRM contact ID
          </label>
          <input
            id="prospect-crm-contact-id"
            type="text"
            value={crmContactId}
            onChange={(e) => setCrmContactId(e.target.value)}
            placeholder="Paste the GHL contact ID"
            autoFocus
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
          <p className="mt-2 text-xs text-slate-500">
            Find this in your CRM contact URL or from a GHL workflow payload.
          </p>

          {error ? (
            <p className="mt-4 text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save link"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
