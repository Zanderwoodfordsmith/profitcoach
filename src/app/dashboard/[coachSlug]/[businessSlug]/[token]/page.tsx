"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublicBossProDashboardView } from "@/components/coach/PublicBossProDashboardView";
import { WorkshopSessionHeaderLabel } from "@/components/coach/WorkshopSessionPicker";
import { StickyPageHeader } from "@/components/layout";
import type { StoredInsights } from "@/lib/insightGenerator";
import type { AnswersMap } from "@/lib/bossScores";

type DashboardPayload = {
  coach_name?: string | null;
  contact?: {
    full_name: string;
    business_name: string | null;
  };
  answers?: AnswersMap;
  total_score?: number;
  session_insights?: StoredInsights | null;
};

export default function PublicBossProDashboardPage() {
  const params = useParams();
  const coachSlug = ((params?.coachSlug as string) ?? "").trim().toLowerCase();
  const businessSlug = ((params?.businessSlug as string) ?? "").trim().toLowerCase();
  const token = ((params?.token as string) ?? "").trim();

  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("This dashboard link is invalid.");
      return;
    }
    if (!coachSlug || !businessSlug) {
      setError("This dashboard link is invalid.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const qs = new URLSearchParams({
          token,
          coach: coachSlug,
          business: businessSlug,
        });
        const res = await fetch(`/api/public/boss-pro-dashboard?${qs}`);
        const body = (await res.json()) as DashboardPayload & { error?: string };
        if (!res.ok || !body.contact || !body.answers) {
          if (!cancelled) {
            setError(body.error ?? "Could not load this dashboard.");
          }
          return;
        }
        if (!cancelled) {
          setPayload(body);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load this dashboard.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, coachSlug, businessSlug]);

  useEffect(() => {
    if (!payload?.contact) return;
    const label = payload.contact.business_name ?? payload.contact.full_name;
    document.title = label ? `Boss Pro — ${label}` : "Boss Pro dashboard";
  }, [payload]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-600">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !payload?.contact || !payload.answers || payload.total_score == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="max-w-md text-center text-slate-600">
          {error ?? "Could not load this dashboard."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 pb-6 md:px-[60px]">
      <div className="flex min-w-0 flex-col gap-6">
        <StickyPageHeader
          title="Boss Pro"
          nowrap
          actions={
            <WorkshopSessionHeaderLabel
              fullName={payload.contact.full_name}
              businessName={payload.contact.business_name}
            />
          }
        />
        <div className="min-w-0 overflow-x-hidden">
          <PublicBossProDashboardView
            contact={payload.contact}
            coachName={payload.coach_name}
            answers={payload.answers}
            totalScore={payload.total_score}
            sessionInsights={payload.session_insights ?? null}
          />
        </div>
      </div>
    </div>
  );
}
