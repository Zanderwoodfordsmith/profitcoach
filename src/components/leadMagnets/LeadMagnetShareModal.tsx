"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { LeadMagnetShareSettings } from "@/components/leadMagnets/LeadMagnetShareSettings";
import { PublicSlugEditor } from "@/components/leadMagnets/PublicSlugEditor";
import { cardClass } from "@/components/ui/Card";
import type { LeadMagnetId } from "@/lib/leadMagnets/catalog";

type Props = {
  open: boolean;
  magnetId: LeadMagnetId;
  title: string;
  coachSlug: string | null;
  appOrigin: string;
  impersonatingCoachId?: string | null;
  prospectsHref: string;
  onSlugChange: (slug: string) => void;
  onClose: () => void;
};

export function LeadMagnetShareModal({
  open,
  magnetId,
  title,
  coachSlug,
  appOrigin,
  impersonatingCoachId,
  prospectsHref,
  onSlugChange,
  onClose,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 py-10">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cardClass("raised", "relative w-full max-w-2xl")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Share {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="space-y-6 px-5 py-5">
          <PublicSlugEditor
            slug={coachSlug ?? ""}
            onSlugChange={onSlugChange}
            framed={false}
          />
          <LeadMagnetShareSettings
            embedded
            magnetId={magnetId}
            coachSlug={coachSlug}
            appOrigin={appOrigin}
            impersonatingCoachId={impersonatingCoachId}
            prospectsHref={prospectsHref}
          />
        </div>
      </div>
    </div>
  );
}
