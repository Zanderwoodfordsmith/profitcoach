"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { PLAYBOOKS, LEVELS, AREAS, type BossPlaybook } from "@/lib/bossData";
import type { PlaybookTabStats, TabStatus } from "@/lib/playbookTabStatus";

type GroupBy = "level" | "area";

const TAB_OPTIONS: { value: TabStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "in_progress", label: "In progress" },
  { value: "not_started", label: "Not started" },
];

function statusBg(status: TabStatus): string {
  return status === "done"
    ? "bg-green-200"
    : status === "in_progress"
      ? "bg-amber-200"
      : "bg-rose-200";
}

export default function AdminPlaybooksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("level");
  const [stats, setStats] = useState<PlaybookTabStats[]>([]);

  const statsByRef = useMemo(() => {
    const m = new Map<string, PlaybookTabStats>();
    for (const s of stats) m.set(s.ref, s);
    return m;
  }, [stats]);

  async function updateTabStatus(
    ref: string,
    tab: "overview" | "client" | "coaches",
    value: TabStatus
  ) {
    setUpdateError(null);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setUpdateError("Not signed in. Please log in again.");
      return;
    }
    const res = await fetch(`/api/admin/playbooks/${encodeURIComponent(ref)}/stats`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ [tab]: value }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setUpdateError(data?.error ?? "Failed to update status. The playbook_tab_status table may not exist — run the migration in supabase/migrations/20250216000000_playbook_tab_status.sql.");
      return;
    }
    setStats((prev) =>
      prev.map((s) =>
        s.ref === ref ? { ...s, [tab]: value } : s
      )
    );
  }

  const groupedPlaybooks = useMemo(() => {
    const sorted = [...PLAYBOOKS].sort(
      (a, b) => (a.level - b.level) * 10 + (a.area - b.area)
    );
    if (groupBy === "level") {
      const byLevel = new Map<number, BossPlaybook[]>();
      for (const p of sorted) {
        const list = byLevel.get(p.level) ?? [];
        list.push(p);
        byLevel.set(p.level, list);
      }
      return Array.from({ length: 5 }, (_, i) => 5 - i)
        .reverse()
        .map((level) => ({
          key: level,
          label: LEVELS.find((l) => l.id === level)?.name ?? `Level ${level}`,
          playbooks: byLevel.get(level) ?? [],
        }))
        .filter((g) => g.playbooks.length > 0);
    }
    const byArea = new Map<number, BossPlaybook[]>();
    for (const p of sorted) {
      const list = byArea.get(p.area) ?? [];
      list.push(p);
      byArea.set(p.area, list);
    }
    return Array.from({ length: 10 }, (_, i) => i)
      .map((areaId) => ({
        key: areaId,
        label: AREAS.find((a) => a.id === areaId)?.name ?? `Area ${areaId}`,
        playbooks: (byArea.get(areaId) ?? []).sort((a, b) => a.level - b.level),
      }))
      .filter((g) => g.playbooks.length > 0);
  }, [groupBy]);

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
      if (cancelled) return;
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.access_token) {
        const statsRes = await fetch("/api/admin/playbooks/stats", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (statsRes.ok) {
          const statsBody = (await statsRes.json()) as { playbooks?: PlaybookTabStats[] };
          setStats(statsBody.playbooks ?? []);
        }
      }
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
        title="Playbooks"
        description="Browse the full Profit System playbook library."
        below={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-600">Group by</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              <option value="level">Level (Overwhelm → Owner)</option>
              <option value="area">Area (Owner Performance, Aligned Vision, …)</option>
            </select>
          </div>
        }
      />

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {updateError && (
        <p className="text-sm text-rose-600" role="alert">
          {updateError}
        </p>
      )}

      {!loading && !error && (
        <div
          className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm min-h-0"
          style={{ maxHeight: "calc(100vh - 14rem)" }}
        >
          <div className="overflow-y-auto overflow-x-auto flex-1">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3 text-left">Playbook</th>
                  <th className="px-4 py-3 text-center min-w-[8rem]">Overview</th>
                  <th className="px-4 py-3 text-center min-w-[8rem]">Client</th>
                  <th className="px-4 py-3 text-center min-w-[8rem]">Coaches</th>
                </tr>
              </thead>
              <tbody>
                {groupedPlaybooks.map((group, groupIndex) => (
                  <Fragment key={group.key}>
                    {groupIndex > 0 && (
                      <tr>
                        <td colSpan={4} className="h-6 p-0 bg-transparent" />
                      </tr>
                    )}
                    <tr className="bg-slate-50/80">
                      <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        {group.label}
                      </td>
                    </tr>
                    {group.playbooks.map((p) => {
                    const s = statsByRef.get(p.ref);
                    const overview = s?.overview ?? "not_started";
                    const client = s?.client ?? "not_started";
                    const coaches = s?.coaches ?? "not_started";
                    return (
                      <tr key={p.ref} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-2">
                          <Link
                            href={`/admin/playbooks/${p.ref}`}
                            className="font-medium text-slate-900 hover:text-slate-700"
                          >
                            {p.ref} {p.name}
                          </Link>
                        </td>
                        <td className="p-0 align-middle">
                          <select
                            value={overview}
                            onChange={(e) => updateTabStatus(p.ref, "overview", e.target.value as TabStatus)}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full min-w-[8rem] cursor-pointer border-0 px-3 py-2 text-center text-sm font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0 ${statusBg(overview)}`}
                          >
                            {TAB_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-0 align-middle">
                          <select
                            value={client}
                            onChange={(e) => updateTabStatus(p.ref, "client", e.target.value as TabStatus)}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full min-w-[8rem] cursor-pointer border-0 px-3 py-2 text-center text-sm font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0 ${statusBg(client)}`}
                          >
                            {TAB_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-0 align-middle">
                          <select
                            value={coaches}
                            onChange={(e) => updateTabStatus(p.ref, "coaches", e.target.value as TabStatus)}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full min-w-[8rem] cursor-pointer border-0 px-3 py-2 text-center text-sm font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0 ${statusBg(coaches)}`}
                          >
                            {TAB_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
