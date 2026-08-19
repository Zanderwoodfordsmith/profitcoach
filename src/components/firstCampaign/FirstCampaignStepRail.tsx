"use client";

import { Check, Lock } from "lucide-react";
import type { CampaignStep } from "@/lib/firstCampaign/types";

export type StepStatus = "complete" | "active" | "available" | "locked";

export type StepRailItem = {
  id: CampaignStep;
  label: string;
  description: string;
  status: StepStatus;
};

export function FirstCampaignStepRail({
  items,
  onSelect,
  ariaLabel = "First Campaign steps",
}: {
  items: StepRailItem[];
  onSelect: (step: CampaignStep) => void;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-1">
      {items.map((item, idx) => {
        const disabled = item.status === "locked";
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item.id)}
            aria-current={item.status === "active" ? "step" : undefined}
            className={`flex items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
              item.status === "active"
                ? "bg-sky-50 ring-1 ring-inset ring-sky-200"
                : disabled
                  ? "opacity-50"
                  : "hover:bg-slate-50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                item.status === "complete"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : item.status === "active"
                    ? "border-sky-600 bg-sky-600 text-white"
                    : disabled
                      ? "border-slate-200 bg-white text-slate-400"
                      : "border-slate-300 bg-white text-slate-500"
              }`}
            >
              {item.status === "complete" ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : disabled ? (
                <Lock className="h-3 w-3" />
              ) : (
                idx + 1
              )}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-sm font-medium ${
                  item.status === "active" ? "text-sky-900" : "text-slate-800"
                }`}
              >
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
