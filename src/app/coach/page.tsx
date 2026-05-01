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

  useEffect(() => {
    if (!loading && profile && !error) {
      router.replace("/coach/signature");
    }
  }, [loading, profile, error, router]);

  if (loading) {
    return <p className="text-sm text-slate-600">Redirecting…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  return <p className="text-sm text-slate-600">Redirecting…</p>;
}

