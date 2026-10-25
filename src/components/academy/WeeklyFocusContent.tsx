"use client";

import { useEffect, useState } from "react";

import { AcademyMarkdown } from "@/components/academy/AcademyMarkdown";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

/** The week's audio and lesson text, loaded for a signed-in member. */
export function WeeklyFocusContent({ weekId }: { weekId: string }) {
  const { impersonatingCoachId } = useImpersonation();
  const [content, setContent] = useState<{ bodyMarkdown: string | null; audioUrl: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers || cancelled) return;
      const res = await fetch(`/api/academy/weekly-focus?weekId=${encodeURIComponent(weekId)}`, { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { bodyMarkdown?: string | null; audioUrl?: string | null } | null;
      if (!cancelled && res?.ok && body) setContent({ bodyMarkdown: body.bodyMarkdown ?? null, audioUrl: body.audioUrl ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, [weekId, impersonatingCoachId]);

  if (!content) return null;
  return (
    <>
      {content.audioUrl ? (
        <div className="mt-6">
          <p className="text-kicker font-semibold uppercase text-slate-500">Listen</p>
          <audio className="mt-3 w-full" controls src={content.audioUrl}>
            Your browser does not support the audio element.
          </audio>
        </div>
      ) : null}
      {content.bodyMarkdown?.trim() ? (
        <div className="mt-8 border-t border-slate-200/80 pt-6">
          <AcademyMarkdown markdown={content.bodyMarkdown} />
        </div>
      ) : null}
    </>
  );
}
