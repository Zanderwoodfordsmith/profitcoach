"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CoachAttribution } from "./CoachAttribution";

type CoachInfo = {
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  slug: string;
};

type Props = {
  /** Optional fallback slug from server; we also read from URL so refresh works. */
  coachSlug?: string | null;
};

/** Fetches coach by slug via API (reads slug from URL so it works on refresh) and renders Written by box. */
export function PlaybookCoachAttribution({ coachSlug: coachSlugProp }: Props) {
  const searchParams = useSearchParams();
  const slugFromUrl = searchParams.get("coach")?.trim() ?? null;
  const coachSlug = slugFromUrl ?? coachSlugProp ?? null;

  const [coach, setCoach] = useState<CoachInfo | null>(null);

  useEffect(() => {
    if (!coachSlug) return;
    const slug: string = coachSlug;
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/coach-by-slug?slug=${encodeURIComponent(slug)}`);
      if (cancelled) return;
      if (!res.ok) return;
      const data = (await res.json()) as CoachInfo;
      if (cancelled) return;
      setCoach(data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [coachSlug]);

  if (!coach) return null;
  return <CoachAttribution coach={coach} />;
}
