"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type CoachProfile = {
  id: string;
  full_name: string | null;
  coach_business_name: string | null;
  slug: string | null;
};

export default function CoachDashboardPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
        error?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }
      const effectiveCoachId =
        roleBody.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }

      const infoRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: effectiveCoachId }),
      });
      const infoBody = (await infoRes.json().catch(() => ({}))) as {
        full_name?: string | null;
        coach_business_name?: string | null;
        coach_slug?: string | null;
      };
      if (cancelled) return;
      if (!infoRes.ok) {
        setError("Unable to load coach info.");
        setLoading(false);
        return;
      }
      const slug = infoBody.coach_slug ?? null;
      if (!slug) {
        setError(
          "Coach record not found. Ask an admin to create a row in the 'coaches' table with your id and slug."
        );
        setLoading(false);
        return;
      }

      setProfile({
        id: effectiveCoachId,
        full_name: infoBody.full_name ?? null,
        coach_business_name: infoBody.coach_business_name ?? null,
        slug,
      });
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const assessmentLink =
    profile && profile.slug
      ? origin
        ? `${origin}/landing/a?coach=${encodeURIComponent(profile.slug)}`
        : `/landing/a?coach=${encodeURIComponent(profile.slug)}`
      : null;

  return (
    <div className="flex flex-col gap-4">
        <header className="border-b border-slate-200 pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            BOSS Dashboard
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Coach dashboard
          </h1>
          {profile && (
            <p className="mt-1 text-sm text-slate-700">
              {profile.full_name ?? "Coach"}
              {profile.coach_business_name
                ? ` @ ${profile.coach_business_name}`
                : null}
            </p>
          )}
        </header>

        {loading && (
          <p className="text-sm text-slate-600">Loading…</p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {profile && assessmentLink && !loading && !error && (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Your prospect link
            </h2>
            <p className="text-xs text-slate-700">
              Share this link with prospects. When they complete the
              assessment, their results will be stored under your
              account.
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-sky-700">
              <span className="truncate">{assessmentLink}</span>
            </div>
          </section>
        )}

        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Prospects &amp; clients
          </h2>
          <p className="text-xs text-slate-700">
            Manage prospects and clients from the sidebar. Add
            prospects and share your assessment link, or view results.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-500"
              onClick={() => router.push("/coach/prospects")}
            >
              View prospects →
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => router.push("/coach/clients")}
            >
              View clients →
            </button>
          </div>
        </section>
    </div>
  );
}

