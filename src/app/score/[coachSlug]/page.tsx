"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { searchParamsWithoutVariant } from "@/lib/funnelVariant";

/**
 * /score/demo → same destination as /score?coach=demo, with a cleaner share URL.
 * The path segment is the coach slug (database `coaches.slug`), not display name.
 */
function ScoreCoachRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  useEffect(() => {
    const raw = params.coachSlug;
    const coachSlug = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
    const sp = new URLSearchParams(searchParams.toString());
    if (coachSlug) sp.set("coach", coachSlug);
    const suffix = searchParamsWithoutVariant(sp);
    router.replace(`/landing/d${suffix}`);
  }, [router, searchParams, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <p className="text-sm text-slate-600">Redirecting…</p>
    </div>
  );
}

export default function ScoreCoachSlugPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <ScoreCoachRedirect />
    </Suspense>
  );
}
