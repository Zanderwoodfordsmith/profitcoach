import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LeadFlowMapPreview } from "@/components/academy/LeadFlowMapPreview";
import "./classroomSystemBanner.css";

/**
 * "mist" is a dusty grey-blue so the banner sits quieter than the course
 * cards; "brand" puts the sidebar gradient behind the copy; "glass" is the
 * first version, matching the course cards.
 */
type Variant = "mist" | "brand" | "glass";

/** Sits under the course grid: the System map's way in now it has no tab. */
export function ClassroomSystemBanner({
  href,
  variant = "mist",
}: {
  href: string;
  variant?: Variant;
}) {
  const brand = variant === "brand";

  return (
    <Link
      href={href}
      className="classroom-system-banner group mt-6 flex flex-col overflow-hidden rounded-xl border border-white/80 bg-white/35 shadow-[0_16px_44px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-inset ring-white/55 transition duration-300 hover:bg-white/45 hover:shadow-[0_28px_56px_rgba(15,23,42,0.24),0_8px_18px_rgba(15,23,42,0.1),0_0_0_1px_rgba(12,82,144,0.12),0_0_22px_rgba(12,82,144,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div className="classroom-system-banner__preview">
        <LeadFlowMapPreview className="classroom-system-banner__map" />
      </div>
      <div
        className={`classroom-system-banner__copy flex flex-col justify-center p-5 sm:p-6 ${
          variant === "glass" ? "" : `classroom-system-banner__copy--${variant}`
        }`}
      >
        <h2
          className={`text-lg font-semibold leading-snug tracking-tight ${
            brand ? "text-white" : "text-slate-900"
          }`}
        >
          The Portfolio System
        </h2>
        <p
          className={`mt-1.5 max-w-md text-pretty text-sm leading-relaxed ${
            brand ? "text-white/90" : "text-slate-600"
          }`}
        >
          The step-by-step process to build your advisory portfolio, from finding clients to
          keeping them. Each step opens its lesson.
        </p>
        {variant !== "glass" ? (
          <span className="classroom-system-banner__button mt-4 inline-flex self-start items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0c5290] shadow-sm transition group-hover:bg-sky-50">
            Open the map
            <ArrowRight
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        ) : (
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c5290]">
            Open the map
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={2}
              aria-hidden
            />
          </span>
        )}
      </div>
    </Link>
  );
}
