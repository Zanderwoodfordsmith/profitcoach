"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/** Legacy `?token=` links redirect to the path-based share URL. */
export default function LegacyBossProDashboardRedirectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const coachSlug = ((params?.coachSlug as string) ?? "").trim();
  const businessSlug = ((params?.businessSlug as string) ?? "").trim();
  const token = searchParams?.get("token")?.trim() ?? "";

  useEffect(() => {
    if (token && coachSlug && businessSlug) {
      router.replace(
        `/dashboard/${encodeURIComponent(coachSlug)}/${encodeURIComponent(businessSlug)}/${encodeURIComponent(token)}`
      );
    }
  }, [token, coachSlug, businessSlug, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <p className="text-slate-600">
        {token ? "Redirecting…" : "This dashboard link is invalid."}
      </p>
    </div>
  );
}
