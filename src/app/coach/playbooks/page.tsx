"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { PLAYBOOKS, LEVELS, AREAS, type BossPlaybook } from "@/lib/bossData";
import type { ClientPlaybookStatus } from "@/app/api/coach/playbooks/route";

type GroupBy = "level" | "area";

type Client = { id: string; full_name: string };

const STATUS_OPTIONS: { value: ClientPlaybookStatus; label: string }[] = [
  { value: "locked", label: "Locked" },
  { value: "in_progress", label: "In progress" },
  { value: "implemented", label: "Implemented" },
];

function statusBg(status: ClientPlaybookStatus): string {
  return status === "implemented"
    ? "bg-green-200"
    : status === "in_progress"
      ? "bg-amber-200"
      : "bg-rose-200";
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function IconOpen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

export default function CoachPlaybooksPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("level");
  const [clients, setClients] = useState<Client[]>([]);
  const [statusByKey, setStatusByKey] = useState<Record<string, ClientPlaybookStatus>>({});
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const getStatus = useCallback(
    (contactId: string, ref: string): ClientPlaybookStatus => {
      return statusByKey[`${contactId}:${ref}`] ?? "locked";
    },
    [statusByKey]
  );

  async function updateStatus(
    contactId: string,
    ref: string,
    status: ClientPlaybookStatus
  ) {
    setUpdateError(null);
    const key = `${contactId}:${ref}`;
    setUpdating(key);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setUpdateError("Not signed in. Please log in again.");
      setUpdating(null);
      return;
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    const res = await fetch("/api/coach/playbooks/status", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ contact_id: contactId, playbook_ref: ref, status }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setUpdateError(data?.error ?? "Failed to update status.");
      setUpdating(null);
      return;
    }
    setStatusByKey((prev) => ({ ...prev, [key]: status }));
    setUpdating(null);
  }

  function shareUrl(ref: string): string {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    const slug = coachSlug ?? "";
    return `${origin}/playbooks/${ref}${slug ? `?coach=${encodeURIComponent(slug)}` : ""}`;
  }

  async function copyLink(ref: string) {
    const url = shareUrl(ref);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 2000);
    } catch {
      setUpdateError("Could not copy to clipboard.");
    }
  }

  function openLink(ref: string) {
    window.open(shareUrl(ref), "_blank", "noopener,noreferrer");
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
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
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
      if (roleBody.role !== "coach" && roleBody.role !== "admin") {
        router.replace("/login");
        return;
      }
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const [playbooksRes, profileRes] = await Promise.all([
        fetch("/api/coach/playbooks", { headers }),
        fetch("/api/coach/profile", { headers }),
      ]);
      if (cancelled) return;
      if (playbooksRes.ok) {
        const body = (await playbooksRes.json()) as {
          clients?: Client[];
          statusByKey?: Record<string, ClientPlaybookStatus>;
        };
        setClients(body.clients ?? []);
        setStatusByKey(body.statusByKey ?? {});
      }
      if (profileRes.ok) {
        const profileBody = (await profileRes.json()) as { coach_slug?: string | null };
        setCoachSlug(profileBody.coach_slug ?? null);
      }
      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Playbooks"
        description="Per-client status: Locked (no client view), In progress, or Implemented. Share the overview link with clients."
        below={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-600">Group by</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              <option value="level">Level</option>
              <option value="area">Area</option>
            </select>
          </div>
        }
      />

      <div className="flex w-full flex-col gap-4">
      {updateError && (
        <p className="text-sm text-rose-600" role="alert">
          {updateError}
        </p>
      )}

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
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
                  <th className="px-4 py-3 text-left min-w-[12rem]">Playbook</th>
                  <th className="px-2 py-3 text-center min-w-[6rem]">Share</th>
                  {clients.map((c) => (
                    <th key={c.id} className="px-2 py-3 text-center min-w-[6rem]" title={c.full_name}>
                      {c.full_name.length > 10 ? c.full_name.slice(0, 8) + "…" : c.full_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedPlaybooks.map((group, groupIndex) => (
                  <Fragment key={group.key}>
                    {groupIndex > 0 && (
                      <tr>
                        <td colSpan={2 + clients.length} className="h-6 p-0 bg-transparent" />
                      </tr>
                    )}
                    <tr className="bg-slate-50/80">
                      <td colSpan={2 + clients.length} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        {group.label}
                      </td>
                    </tr>
                    {group.playbooks.map((p) => {
                      return (
                        <tr key={p.ref} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2">
                            <Link
                              href={coachSlug ? `/playbooks/${p.ref}?coach=${encodeURIComponent(coachSlug)}` : `/playbooks/${p.ref}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-slate-900 hover:text-slate-700"
                            >
                              {p.ref} {p.name}
                            </Link>
                          </td>
                          <td className="px-2 py-2 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => copyLink(p.ref)}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                                title="Copy share link"
                              >
                                <IconLink className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openLink(p.ref)}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                                title="Open overview page"
                              >
                                <IconOpen className="h-4 w-4" />
                              </button>
                              {copiedRef === p.ref && (
                                <span className="text-xs text-emerald-600">Copied!</span>
                              )}
                            </div>
                          </td>
                          {clients.map((c) => {
                            const status = getStatus(c.id, p.ref);
                            const key = `${c.id}:${p.ref}`;
                            const isUpdating = updating === key;
                            return (
                              <td key={c.id} className="p-0 align-middle">
                                <select
                                  value={status}
                                  onChange={(e) => updateStatus(c.id, p.ref, e.target.value as ClientPlaybookStatus)}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={isUpdating}
                                  className={`w-full min-w-[6rem] cursor-pointer border-0 px-2 py-2 text-center text-sm font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0 disabled:opacity-60 ${statusBg(status)}`}
                                >
                                  {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
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
    </div>
  );
}
