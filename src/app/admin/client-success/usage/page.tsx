"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";

type UsageOverview = {
  dau: number;
  wau: number;
  mau: number;
  sessions: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  avgSessionDurationSeconds: number;
  totalPageViews30d: number;
  roleActiveUsers30d: Array<{ role: string; activeUsers: number }>;
  dailySeries30d: Array<{
    date: string;
    activeUsers: number;
    sessions: number;
    avgSessionDurationSeconds: number;
  }>;
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function AdminUsagePage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UsageOverview | null>(null);

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
          setError("Unable to load usage analytics.");
          setLoading(false);
        }
        return;
      }

      const res = await fetch("/api/admin/usage/overview", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = (await res.json().catch(() => ({}))) as
        | UsageOverview
        | { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError((body as { error?: string }).error ?? "Unable to load usage analytics.");
        setLoading(false);
        return;
      }
      setData(body as UsageOverview);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const roleRows = useMemo(
    () => [...(data?.roleActiveUsers30d ?? [])].sort((a, b) => b.activeUsers - a.activeUsers),
    [data]
  );

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader title="Coaches" tabs={<CoachesHubTabs />} />

      {checkingRole ? <p className="text-sm text-slate-600">Checking access…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!checkingRole && !error && data ? (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">DAU</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.dau}</p>
              <p className="text-xs text-slate-500">Unique active users (24h)</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">WAU</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.wau}</p>
              <p className="text-xs text-slate-500">Unique active users (7d)</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">MAU</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.mau}</p>
              <p className="text-xs text-slate-500">Unique active users (30d)</p>
            </article>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sessions (24h)</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data.sessions.last24h}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sessions (7d)</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data.sessions.last7d}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sessions (30d)</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data.sessions.last30d}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Avg session</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatDuration(data.avgSessionDurationSeconds)}
              </p>
            </article>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Page views (30d)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.totalPageViews30d}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Active users by role (30d)
              </p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                {roleRows.map((row) => (
                  <p key={row.role}>
                    <span className="font-medium capitalize">{row.role}</span>: {row.activeUsers}
                  </p>
                ))}
                {roleRows.length === 0 ? <p className="text-slate-500">No data yet.</p> : null}
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Daily trend (last 30 days)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Active users</th>
                    <th className="px-2 py-2">Sessions</th>
                    <th className="px-2 py-2">Avg session</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailySeries30d.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100 text-slate-700">
                      <td className="px-2 py-2">{row.date}</td>
                      <td className="px-2 py-2">{row.activeUsers}</td>
                      <td className="px-2 py-2">{row.sessions}</td>
                      <td className="px-2 py-2">{formatDuration(row.avgSessionDurationSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {!checkingRole && loading && !error ? (
        <p className="text-sm text-slate-600">Loading usage analytics…</p>
      ) : null}
    </div>
  );
}
