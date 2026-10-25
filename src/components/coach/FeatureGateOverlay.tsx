"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

const BRAND_GRADIENT = "linear-gradient(135deg, #0c5290 0%, #063056 100%)";

/**
 * Skool / chess.com-style soft gate: the real page renders behind, greyed and
 * blurred, with a context-relevant upgrade modal in the middle. The modal can
 * be dismissed to peek at the (non-interactive) content underneath. Only wraps
 * the main content region, so the sidebar stays fully usable.
 */
export function FeatureGateOverlay({ title, description, children }: Props) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="relative">
      <div
        className="pointer-events-none select-none opacity-60 blur-[2px] grayscale"
        aria-hidden
      >
        {children}
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex justify-center bg-white/40 px-4">
        {!dismissed ? (
          <div className={cardClass("raised", "pointer-events-auto sticky top-[14vh] mb-24 mt-[12vh] h-fit w-full max-w-md p-6 text-center sm:p-8")}>
            <span
              className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl text-white"
              style={{ background: BRAND_GRADIENT }}
            >
              <Lock className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <p className="mt-4 text-kicker font-semibold uppercase text-[#0c5290]">
              Membership
            </p>
            <h2 className="mt-1.5 text-subhead font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mx-auto mt-2.5 max-w-sm text-ui leading-relaxed text-slate-600">
              {description}
            </p>
            <Link
              href="/coach/membership#plans"
              className={buttonClass("main", "normal", "mt-6 w-full")}
            >
              Unlock with membership
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className={buttonClass("quiet", "normal", "mt-3")}
            >
              Not now
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDismissed(false)}
            className={buttonClass("second", "small", "pointer-events-auto sticky top-4 mt-4 h-fit shadow-lg")}
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Unlock with membership
          </button>
        )}
      </div>
    </div>
  );
}
