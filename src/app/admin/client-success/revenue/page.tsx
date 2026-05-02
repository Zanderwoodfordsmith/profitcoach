"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type CoachRevenueRow = {
  coachId: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  client_count: number;
  last_occurred_on: string | null;
  sum_this_calendar_month: number;
  sum_previous_calendar_month: number;
  sum_last_3_calendar_months: number;
  stale_no_revenue_60d: boolean;
};

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AdminCoachRevenuePage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const [rows, setRows] = useState<CoachRevenueRow[]>([]);
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setCheckingRole(true);
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
      };
      if (!roleRes.ok || !roleBody.role) {
        if (!cancelled) {
          setError("Unable to load your profile.");
          setCheckingRole(false);
          setLoading(false);
        }
        return;
      }

      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      setCheckingRole(false);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setError("Unable to load revenue summary.");
          setLoading(false);
        }
        return;
      }

      const res = await fetch("/api/admin/coach-revenue-summary", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        coaches?: CoachRevenueRow[];
        error?: string;
      };

      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Unable to load revenue summary.");
        setLoading(false);
        return;
      }

      setRows(body.coaches ?? []);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Coach income"
        description="Cash logged by coaches (manual entries). Open a coach’s ledger with View as coach."
        descriptionPlacement="below"
        tabs={<CoachesHubTabs />}
      />

      {checkingRole ? <p className="text-sm text-slate-600">Checking access…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!checkingRole && !loading && !error && rows.length === 0 ? (
        <p className="text-sm text-slate-600">No coaches found.</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[56rem] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Coach</th>
              <th className="px-4 py-2 text-center">Clients</th>
              <th className="px-4 py-2 text-right">This month</th>
              <th className="px-4 py-2 text-right">Last month</th>
              <th className="px-4 py-2 text-right">Last 3 mo</th>
              <th className="px-4 py-2">Last entry</th>
              <th className="px-4 py-2 text-center">Stale</th>
              <th className="px-4 py-2 text-center">Ledger</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.coachId} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 align-top">
                  <p className="font-medium text-slate-900">{row.full_name ?? "—"}</p>
                  <p className="text-xs text-slate-600">{row.coach_business_name ?? "—"}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{row.slug}</p>
                </td>
                <td className="px-4 py-2 text-center text-slate-800">{row.client_count}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-900">
                  {formatGbp(row.sum_this_calendar_month)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-800">
                  {formatGbp(row.sum_previous_calendar_month)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-800">
                  {formatGbp(row.sum_last_3_calendar_months)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {row.last_occurred_on ?? "—"}
                </td>
                <td className="px-4 py-2 text-center">
                  {row.stale_no_revenue_60d ? (
                    <span
                      className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                      title="No income logged in the last 60 days"
                    >
                      60d+
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setImpersonatingCoachId(row.coachId);
                      router.push("/coach/income");
                    }}
                    className="rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-200"
                  >
                    Open ledger
                  </button>
                </td>
              </tr>
            ))}
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-slate-600">
                  Loading revenue summary…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
