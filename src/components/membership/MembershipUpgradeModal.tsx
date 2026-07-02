"use client";

import Link from "next/link";
import { Lock, X } from "lucide-react";

import {
  COACH_ACCESS_TIER_LABELS,
  type CoachAccessTier,
} from "@/lib/coachAccess/tiers";

type Props = {
  open: boolean;
  onClose: () => void;
  requiredTier: CoachAccessTier;
  eventTitle?: string;
};

export function MembershipUpgradeModal({
  open,
  onClose,
  requiredTier,
  eventTitle,
}: Props) {
  if (!open) return null;

  const tierLabel = COACH_ACCESS_TIER_LABELS[requiredTier];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="membership-upgrade-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h2 id="membership-upgrade-title" className="text-lg font-semibold text-slate-900">
              {tierLabel} membership required
            </h2>
            {eventTitle ? (
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium">{eventTitle}</span> is included in{" "}
                {tierLabel} and above.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                This call is included in {tierLabel} and above.
              </p>
            )}
            <p className="mt-3 text-sm text-slate-600">
              Upgrade your membership to join weekly calls, implementation support, and more.
            </p>
            <Link
              href="/coach/membership"
              onClick={onClose}
              className="mt-4 inline-block rounded-lg bg-[#0c5290] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4274]"
            >
              View membership plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
