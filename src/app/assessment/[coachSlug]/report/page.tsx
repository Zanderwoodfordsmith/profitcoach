"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BossScorecardResults } from "@/components/scorecard/BossScorecardResults";
import {
  calendarContactFromFields,
  resolveReportCalendarContact,
  type CalendarContactParams,
} from "@/lib/calendarContactParams";
import type { ScorecardResultPayload } from "@/lib/bossScorecardScores";
import { getPrimaryCoachSlug } from "@/lib/primaryCoach";
import { supabaseClient } from "@/lib/supabaseClient";

export default function ScorecardReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const coachSlugFromPath = (params?.coachSlug as string) ?? getPrimaryCoachSlug();
  const token = searchParams?.get("token")?.trim() ?? "";

  const [result, setResult] = useState<ScorecardResultPayload | null>(null);
  const [calendarContact, setCalendarContact] =
    useState<CalendarContactParams | null>(null);
  const [coachSlug, setCoachSlug] = useState(coachSlugFromPath);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("This report link is missing a token.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const qs = new URLSearchParams({ token });
        if (coachSlugFromPath) qs.set("coach", coachSlugFromPath);
        const res = await fetch(`/api/public/scorecard-report?${qs}`);
        const body = (await res.json()) as {
          error?: string;
          coach_slug?: string;
          result?: ScorecardResultPayload;
          contact?: {
            first_name?: string | null;
            last_name?: string | null;
            full_name?: string | null;
            email?: string | null;
            phone?: string | null;
          };
        };
        if (!res.ok || !body.result) {
          if (!cancelled) {
            setError(body.error ?? "Could not load this report.");
          }
          return;
        }
        if (!cancelled) {
          setResult(body.result);
          setCoachSlug(body.coach_slug ?? coachSlugFromPath);
          const fromApi = body.contact
            ? calendarContactFromFields({
                firstName: body.contact.first_name,
                lastName: body.contact.last_name,
                fullName: body.contact.full_name,
                email: body.contact.email,
                phone: body.contact.phone,
              })
            : null;
          setCalendarContact(
            resolveReportCalendarContact({
              searchParams,
              sessionContact: fromApi
                ? {
                    firstName: fromApi.firstName ?? undefined,
                    lastName: fromApi.lastName ?? undefined,
                    email: fromApi.email ?? undefined,
                    phone: fromApi.phone ?? undefined,
                  }
                : null,
            })
          );
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load this report.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, coachSlugFromPath, searchParams]);

  useEffect(() => {
    if (!coachSlug) return;
    void (async () => {
      try {
        const { data } = await supabaseClient
          .from("coaches")
          .select("profiles(full_name)")
          .eq("slug", coachSlug)
          .maybeSingle();
        const prof = (data as { profiles?: { full_name?: string } | null } | null)
          ?.profiles;
        if (prof?.full_name) setCoachName(prof.full_name);
      } catch {
        // ignore
      }
    })();
  }, [coachSlug]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-slate-600">Loading your results…</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="max-w-md text-center text-slate-600">
          {error ?? "Loading your results…"}
        </p>
      </div>
    );
  }

  return (
    <BossScorecardResults
      result={result}
      coachSlug={coachSlug}
      coachName={coachName}
      isPreview={false}
      calendarContact={calendarContact}
    />
  );
}
