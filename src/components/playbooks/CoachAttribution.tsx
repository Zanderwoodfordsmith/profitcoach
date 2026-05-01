"use client";

import Link from "next/link";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

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
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        Written by
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{displayName}</p>
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
            className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2.5 text-base font-medium text-white hover:bg-sky-700"
          >
            Work with {displayName.split(" ")[0]}
          </Link>
          {coach.linkedin_url && (
            <a
              href={coach.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              <LinkedInIcon className="h-5 w-5 shrink-0" />
              Connect with me on LinkedIn
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
