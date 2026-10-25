"use client";

import Link from "next/link";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

type CoachInfo = {
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  slug: string;
};

type Props = {
  coach: CoachInfo;
};

export function CoachAttribution({ coach }: Props) {
  const displayName = coach.full_name ?? coach.coach_business_name ?? "Your Coach";
  const displayBusiness =
    coach.coach_business_name && coach.full_name ? coach.coach_business_name : null;

  return (
    <aside className={cardClass("plain", "mt-12 p-6")}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        Written by
      </p>
      <p className="mt-1 text-subhead font-semibold text-slate-900">{displayName}</p>
      {displayBusiness && (
        <p className="mt-0.5 text-base text-slate-600">{displayBusiness}</p>
      )}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {coach.avatar_url ? (
          <img
            src={coach.avatar_url}
            alt={displayName}
            className="h-24 w-24 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-xs font-medium text-slate-400"
            aria-hidden
          >
            Coach photo
          </div>
        )}
        <div className="flex-1">
          <Link
            href={`/landing/a?coach=${encodeURIComponent(coach.slug)}`}
            className={buttonClass("main")}
          >
            Work with {displayName.split(" ")[0]}
          </Link>
          {coach.linkedin_url && (
            <a
              href={coach.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("second", "normal", "ml-3")}
            >
              <LinkedInSolidIcon className="h-5 w-5 shrink-0" />
              Connect with me on LinkedIn
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
