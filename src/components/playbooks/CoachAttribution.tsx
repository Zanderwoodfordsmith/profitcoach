"use client";

import Link from "next/link";

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
    <aside className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {coach.avatar_url ? (
          <img
            src={coach.avatar_url}
            alt={displayName}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xl font-semibold text-sky-700">
            {displayName.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Brought to you by
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{displayName}</p>
          {displayBusiness && (
            <p className="text-sm text-slate-600">{displayBusiness}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={`/landing/a?coach=${encodeURIComponent(coach.slug)}`}
              className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Work with {displayName.split(" ")[0]}
            </Link>
            {coach.linkedin_url && (
              <a
                href={coach.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                LinkedIn
              </a>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
