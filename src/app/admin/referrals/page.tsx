"use client";

import { useEffect, useState } from "react";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { ReferralsHub } from "@/components/referrals/ReferralsHub";
import type { NetworkCoach } from "@/lib/referrals/network";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

const PICK_KEY = "admin_referrals_coach";

/** Admin only while we perfect it. Coaches have no page or API for this yet. */
export default function AdminReferralsPage() {
  const [coaches, setCoaches] = useState<NetworkCoach[] | null>(null);
  const [coachId, setCoachId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getValidSupabaseAccessToken();
      if (!token || cancelled) return;
      const res = await fetch("/api/admin/referrals/coaches", { headers: { Authorization: `Bearer ${token}` } });
      const body = (await res.json().catch(() => null)) as { coaches?: NetworkCoach[]; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.coaches) {
        setError(body?.error ?? "Could not load coaches.");
        return;
      }
      let remembered = "";
      try {
        remembered = localStorage.getItem(PICK_KEY) ?? "";
      } catch {
        remembered = "";
      }
      setCoaches(body.coaches);
      if (body.coaches.some((c) => c.coachId === remembered)) setCoachId(remembered);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = (id: string) => {
    setCoachId(id);
    try {
      localStorage.setItem(PICK_KEY, id);
    } catch {
      // Remembering the pick is a convenience only.
    }
  };

  const coach = coaches?.find((c) => c.coachId === coachId) ?? null;
  const loaded = coaches?.filter((c) => c.total > 0) ?? [];
  const campaignsOnly = coaches?.filter((c) => c.total === 0) ?? [];

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-4xl"
      header={
        <StickyPageHeader
          title="Referrals"
          description="Admin only while we perfect it. Rate a LinkedIn network, or see which members can introduce a coach to their prospects."
          tabs={<ToolkitHubTabs />}
        />
      }
    >
      <div className="mb-10 flex flex-wrap items-center gap-3">
        <label htmlFor="referrals-coach" className="text-sm font-medium text-slate-700">
          Coach
        </label>
        <select
          id="referrals-coach"
          value={coachId}
          onChange={(e) => pick(e.target.value)}
          disabled={!coaches}
          className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">{coaches ? "Pick a coach" : "Loading coaches…"}</option>
          {loaded.length ? (
            <optgroup label="Network loaded">
              {loaded.map((c) => (
                <option key={c.coachId} value={c.coachId}>
                  {c.name} ({c.total.toLocaleString("en-GB")} connections, {c.known.toLocaleString("en-GB")} True)
                </option>
              ))}
            </optgroup>
          ) : null}
          {campaignsOnly.length ? (
            <optgroup label="Campaigns only (see who can introduce them)">
              {campaignsOnly.map((c) => (
                <option key={c.coachId} value={c.coachId}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {coach ? (
        <ReferralsHub key={coach.coachId} coachId={coach.coachId} coachName={coach.name} />
      ) : coaches ? (
        <p className="text-sm text-slate-500">Pick a coach above. Rate only your own network.</p>
      ) : null}
    </DashboardPageSection>
  );
}
