"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SCORE_VARIANT_COOKIE = "score_variant";

function getScoreVariantCookie(): "score-a" | "score-b" | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^| )${SCORE_VARIANT_COOKIE}=(score-a|score-b)`)
  );
  return match ? (match[1] as "score-a" | "score-b") : null;
}

function setScoreVariantCookie(variant: "score-a" | "score-b") {
  if (typeof document === "undefined") return;
  document.cookie = `${SCORE_VARIANT_COOKIE}=${variant};path=/;max-age=2592000`;
}

function ScoreRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : "";
    const existing = getScoreVariantCookie();
    const variant = existing ?? (Math.random() < 0.5 ? "score-a" : "score-b");
    if (!existing) setScoreVariantCookie(variant);
    router.replace(`/${variant}${suffix}`);
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
