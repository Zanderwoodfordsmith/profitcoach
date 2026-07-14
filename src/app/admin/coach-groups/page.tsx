"use client";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import type { CoachGroupSummary } from "@/lib/actionPlans/types";
import { supabaseClient } from "@/lib/supabaseClient";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type CoachOption = {
  id: string;
  label: string;
};

type GroupDetail = CoachGroupSummary & {
  coachIds: string[];
};

export default function AdminCoachGroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCoachIds, setDraftCoachIds] = useState<string[]>([]);
  const [coachSearch, setCoachSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredCoaches = useMemo(() => {
    const q = coachSearch.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((coach) => coach.label.toLowerCase().includes(q));
  }, [coachSearch, coaches]);

  const loadData = useCallback(async (token: string) => {
    const [groupsRes, coachesRes] = await Promise.all([
      fetch("/api/admin/coach-groups", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("/api/admin/coaches", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (!groupsRes.ok || !coachesRes.ok) {
      throw new Error("Failed to load groups or coaches.");
    }
    const groupsData = (await groupsRes.json()) as { groups?: CoachGroupSummary[] };
    const coachesData = (await coachesRes.json()) as {
      coaches?: Array<{
        id: string;
        full_name?: string | null;
        coach_business_name?: string | null;
        slug?: string;
      }>;
    };

    setCoaches(
      (coachesData.coaches ?? []).map((coach) => ({
        id: coach.id,
        label: coach.coach_business_name || coach.full_name || coach.slug || coach.id,
      })),
    );

    const summaries = groupsData.groups ?? [];
    setGroups(
      summaries.map((group) => ({
        ...group,
        coachIds: group.coachIds ?? [],
      }))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          router.replace("/login");
          return;
        }
        if (cancelled) return;
        setAccessToken(session.access_token);
        await loadData(session.access_token);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load coach groups.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadData, router]);

  const startCreate = () => {
    setEditingId("new");
    setDraftName("");
    setDraftDescription("");
    setDraftCoachIds([]);
    setCoachSearch("");
  };

  const startEdit = (group: GroupDetail) => {
    setEditingId(group.id);
    setDraftName(group.name);
    setDraftDescription(group.description ?? "");
    setDraftCoachIds(group.coachIds);
    setCoachSearch("");
  };

  const toggleCoach = (coachId: string) => {
    setDraftCoachIds((prev) =>
      prev.includes(coachId) ? prev.filter((id) => id !== coachId) : [...prev, coachId],
    );
  };

  const saveGroup = async () => {
    if (!accessToken || !draftName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draftName.trim(),
        description: draftDescription.trim(),
        coachIds: draftCoachIds,
      };
      const res = await fetch(
        editingId === "new" ? "/api/admin/coach-groups" : `/api/admin/coach-groups/${editingId}`,
        {
          method: editingId === "new" ? "POST" : "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save group.");
      setEditingId(null);
      await loadData(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group.");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!accessToken) return;
    if (!window.confirm("Delete this coach group?")) return;
    try {
      const res = await fetch(`/api/admin/coach-groups/${groupId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete group.");
      await loadData(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group.");
    }
  };

  return (
    <>
      <StickyPageHeader
        title="Coach groups"
        description="Reusable groups for pushing action plans to selected coaches."
        tabs={<CoachesHubTabs />}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/admin/action-plans"
            className="text-sm font-medium text-sky-700 hover:underline"
          >
            Back to action plans
          </Link>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" />
            New group
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {editingId ? (
          <div className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">
              {editingId === "new" ? "Create group" : "Edit group"}
            </h2>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
              </span>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </span>
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
              />
            </label>
            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Members ({draftCoachIds.length})
              </span>
              <input
                value={coachSearch}
                onChange={(e) => setCoachSearch(e.target.value)}
                placeholder="Search coaches…"
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
              />
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                {filteredCoaches.map((coach) => (
                  <label
                    key={coach.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={draftCoachIds.includes(coach.id)}
                      onChange={() => toggleCoach(coach.id)}
                    />
                    {coach.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !draftName.trim()}
                onClick={() => void saveGroup()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save group
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading groups…
          </div>
        ) : groups.length ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <h3 className="font-semibold text-slate-900">{group.name}</h3>
                  {group.description ? (
                    <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(group)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteGroup(group.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
            No coach groups yet.
          </div>
        )}
      </div>
    </>
  );
}
