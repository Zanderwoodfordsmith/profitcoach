"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  SITE_VARIANTS,
  VARIANT_GROUPS,
  type SiteVariants,
  type VariantGroup,
} from "@/lib/coachSite/variants";
import type { CoachSiteSource } from "@/lib/coachSite/types";

const SOURCE_LABEL: Record<CoachSiteSource, string> = {
  "offer:direction": "The offer",
  "offer:lines": "Your offer in three lengths",
  "story:onepager": "One-page profile",
  "story:bio": "Short bio",
  "proof.client_results": "A client testimonial",
  photo: "A photo",
  location: "Location",
};

type Props = {
  variants: SiteVariants;
  missing: CoachSiteSource[];
  compareHref: string;
};

/** Preview only: switch each part of the page between its versions. The choice lives in the URL. */
export function VariantPanel({ variants, missing, compareHref }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function choose(group: VariantGroup, id: string) {
    const next = new URLSearchParams(params.toString());
    next.set(group, id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="cs-panel">
      {open ? (
        <div className="cs-panel__sheet" role="dialog" aria-label="Design options">
          <div className="cs-panel__title">
            Design options
            <a href={compareHref}>Compare heroes</a>
          </div>
          {VARIANT_GROUPS.map((group) => (
            <div className="cs-panel__group" key={group}>
              <div className="cs-panel__label">{SITE_VARIANTS[group].label}</div>
              <div className="cs-panel__opts">
                {SITE_VARIANTS[group].options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="cs-panel__opt"
                    aria-pressed={variants[group] === opt.id}
                    onClick={() => choose(group, opt.id)}
                  >
                    <b>{opt.label}</b>
                    <span>{opt.note}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {missing.length ? (
            <div className="cs-panel__gaps">
              <strong>Blueprint still needs:</strong> {missing.map((m) => SOURCE_LABEL[m]).join(", ")}.
              Those parts are hidden on a live site.
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="cs-panel__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden="true" /> : <SlidersHorizontal aria-hidden="true" />}
        <span className="cs-panel__toggle-label">{open ? "Close" : "Design options"}</span>
      </button>
    </div>
  );
}
