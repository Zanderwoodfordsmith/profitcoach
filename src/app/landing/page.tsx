"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const LANDING_VARIANT_COOKIE = "landing_variant";

function getVariantCookie(): "a" | "b" | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^| )${LANDING_VARIANT_COOKIE}=([ab])`));
  return match ? (match[1] as "a" | "b") : null;
}

function setVariantCookie(variant: "a" | "b") {
  if (typeof document === "undefined") return;
  document.cookie = `${LANDING_VARIANT_COOKIE}=${variant};path=/;max-age=2592000`;
}

function LandingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const coach = searchParams.get("coach")?.trim() || "";
    const query = coach ? `?coach=${encodeURIComponent(coach)}` : "";
    const existing = getVariantCookie();
    const variant = existing ?? (Math.random() < 0.5 ? "a" : "b");
    if (!existing) setVariantCookie(variant);
    router.replace(`/landing/${variant}${query}`);
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
