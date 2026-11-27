"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";

export type DuplicateCopy = "steps" | "people" | "both";

const OPTIONS: { value: DuplicateCopy; label: string; detail: string }[] = [
  {
    value: "steps",
    label: "Steps",
    detail: "The messages and settings. No people.",
  },
  {
    value: "people",
    label: "People",
    detail: "The same people, with no steps. You write new ones.",
  },
  {
    value: "both",
    label: "Steps and people",
    detail: "A full copy. Everyone starts again at the first step.",
  },
];

/** Duplicate asks what to copy. The copy is always a draft, so nothing sends. */
export function DuplicateCampaignModal({
  campaign,
  busy,
  error,
  onClose,
  onDuplicate,
}: {
  campaign: { id: string; name: string; lead_count?: number } | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onDuplicate: (copy: DuplicateCopy) => void;
}) {
  const [copy, setCopy] = useState<DuplicateCopy>("steps");

  useEffect(() => {
    if (campaign) setCopy("steps");
  }, [campaign]);

  const people = campaign?.lead_count;

  return (
    <Modal
      open={campaign != null}
      onClose={onClose}
      busy={busy}
      title="Duplicate campaign"
      subtitle={campaign ? `What to copy from “${campaign.name}”` : undefined}
      maxWidthClassName="max-w-md"
      overlayClassName="z-[80]"
      footer={
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={buttonClass("quiet")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(copy)}
            disabled={busy}
            className={buttonClass("main")}
          >
            {busy ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      }
    >
      <div className="px-5 py-4">
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="sr-only">What to copy</legend>
          {OPTIONS.map((option) => {
            const selected = copy === option.value;
            const showCount = option.value !== "steps" && typeof people === "number";
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
                  selected
                    ? "border-[#0c5290] bg-sky-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="duplicate-copy"
                  value={option.value}
                  checked={selected}
                  onChange={() => setCopy(option.value)}
                  className="mt-1 h-4 w-4 accent-[#0c5290]"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {option.label}
                    {showCount ? (
                      <span className="font-normal text-slate-500">
                        {" "}
                        · {people} {people === 1 ? "person" : "people"}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">
                    {option.detail}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="mt-3 text-xs text-slate-500">
          The copy starts switched off, so nothing sends until you turn it on.
        </p>
        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
