"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchParamsWithoutVariant } from "@/lib/funnelVariant";

/** Share links: `/score?coach=slug` or cleaner `/score/slug` (slug = coaches.slug, not display name). */

function ScoreRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const suffix = searchParamsWithoutVariant(searchParams);
    router.replace(`/landing/d${suffix}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <p className="text-sm text-slate-600">Redirecting…</p>
    </div>
  );
}

export default function ScoreRootPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <ScoreRedirect />
    </Suspense>
  );
}
