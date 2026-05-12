"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** `/landing` forwards to `/score` so marketing has one canonical funnel entry. */
function LandingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/score?${q}` : "/score");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <p className="text-sm text-slate-600">Redirecting…</p>
    </div>
  );
}

export default function LandingRootPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <LandingRedirect />
    </Suspense>
  );
}
