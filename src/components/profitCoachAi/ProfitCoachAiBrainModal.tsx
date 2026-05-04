"use client";

import { X } from "lucide-react";

import type { CoachAiContext } from "@/lib/profitCoachAi/types";

import { ProfitCoachAiBrainForm } from "./ProfitCoachAiBrainForm";

type Props = {
  open: boolean;
  onClose: () => void;
  compassHref: string;
  initialContext: CoachAiContext;
  draftFromChat?: string | null;
  saving: boolean;
  saveError: string | null;
  onSave: (next: CoachAiContext) => void;
};

export function ProfitCoachAiBrainModal({
  open,
  onClose,
  compassHref,
  initialContext,
  draftFromChat,
  saving,
  saveError,
  onSave,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brain-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="brain-modal-title" className="text-lg font-semibold text-slate-900">
            Your brain
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ProfitCoachAiBrainForm
            compassHref={compassHref}
            initialContext={initialContext}
            draftFromChat={draftFromChat}
            saving={saving}
            saveError={saveError}
            onSave={onSave}
            onCancel={onClose}
            variant="modal"
          />
        </div>
      </div>
    </div>
  );
}
