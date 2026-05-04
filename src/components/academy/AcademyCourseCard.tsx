import Link from "next/link";

import type { AcademyCompassPillarId } from "@/lib/academy/types";
import {
  SIGNATURE_COMPASS_PILLAR_COVER_HEX,
  getSignaturePillarTitleById,
} from "@/lib/signatureModelV2";

type Props = {
  href: string;
  /** Module name (same as My Compass diagram title). */
  moduleTitle: string;
  description: string;
  lessonCount: number;
  compassPillarId?: AcademyCompassPillarId;
  coverImageUrl?: string;
  /**
   * When the module is not on a Compass pillar (e.g. legacy Disco programmes),
   * pass a short label for the cover eyebrow. Uses brand cover styling when
   * `compassPillarId` is omitted.
   */
  eyebrowOverride?: string;
  /** Omits the small uppercase line above the title on the cover image area. */
  hideCoverEyebrow?: boolean;
};

function coverTextClasses(pillarId: AcademyCompassPillarId | undefined) {
  if (pillarId === "enrol") {
    return {
      eyebrow: "text-[#1f3a66]/75",
      title: "text-[#1f3a66]",
    };
  }
  return {
    eyebrow: "text-white/80",
    title: "text-white",
  };
}

export function AcademyCourseCard({
  href,
  moduleTitle,
  description,
  lessonCount,
  compassPillarId,
  coverImageUrl,
  eyebrowOverride,
  hideCoverEyebrow,
}: Props) {
  const pillarLabel = getSignaturePillarTitleById(compassPillarId) ?? "";
  const topEyebrow = (eyebrowOverride?.trim() || pillarLabel || "Programme").trim();
  const legacyCover = !compassPillarId;
  const fill =
    compassPillarId && compassPillarId in SIGNATURE_COMPASS_PILLAR_COVER_HEX
      ? SIGNATURE_COMPASS_PILLAR_COVER_HEX[compassPillarId]
      : legacyCover
        ? "#0c5290"
        : SIGNATURE_COMPASS_PILLAR_COVER_HEX.reach;
  const text = legacyCover
    ? { eyebrow: "text-white/80", title: "text-white" }
    : coverTextClasses(compassPillarId);

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
    >
      <div className="relative aspect-[16/9] bg-slate-200">
        {!coverImageUrl ? (
          <div className="absolute inset-0" style={{ backgroundColor: fill }} aria-hidden />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {coverImageUrl ? (
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
            aria-hidden
          />
        ) : null}
        <div className="relative flex h-full flex-col justify-end p-5">
          {!hideCoverEyebrow ? (
            <p
              className={`text-[10px] font-light uppercase tracking-[0.32em] ${coverImageUrl ? "text-white/85" : text.eyebrow}`}
            >
              {topEyebrow}
            </p>
          ) : null}
          <p
            className={`${hideCoverEyebrow ? "" : "mt-1"} text-lg font-semibold leading-snug tracking-tight ${coverImageUrl ? "text-white" : text.title}`}
          >
            {moduleTitle}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="line-clamp-3 text-base leading-relaxed text-slate-600">
          {description || " "}
        </p>
        <p className="mt-auto pt-3 text-xs text-slate-500">
          {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
        </p>
      </div>
    </Link>
  );
}
