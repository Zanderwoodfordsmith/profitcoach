"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Props = {
  readMinutes: number;
  coachSlug?: string;
};

type CoachAuthor = {
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
};

export function BlogAuthorByline({ readMinutes, coachSlug }: Props) {
  const searchParams = useSearchParams();
  const coachSlugFromUrl = searchParams.get("coach")?.trim() ?? "";
  const effectiveSlug = useMemo(
    () => (coachSlug?.trim() || coachSlugFromUrl || "").toLowerCase(),
    [coachSlug, coachSlugFromUrl]
  );
  const [coach, setCoach] = useState<CoachAuthor | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!effectiveSlug) {
      setCoach(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/directory/coaches/${encodeURIComponent(effectiveSlug)}`);
        if (!res.ok) {
          if (!cancelled) setCoach(null);
          return;
        }
        const data = (await res.json()) as CoachAuthor;
        if (!cancelled) setCoach(data);
      } catch {
        if (!cancelled) setCoach(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSlug]);

  if (!coach) {
    return (
      <p className="mt-6 text-base text-slate-500">
        By The Profit Coach Team · {readMinutes} min read
      </p>
    );
  }

  const displayName =
    coach.full_name?.trim() || coach.coach_business_name?.trim() || "Coach";

  return (
    <div className="mt-6 flex items-center gap-3 text-base text-slate-500">
      {coach.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coach.avatar_url}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
        >
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span>
        By {displayName} · {readMinutes} min read
      </span>
    </div>
  );
}
