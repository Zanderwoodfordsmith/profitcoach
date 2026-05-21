"use client";

import type { CoachGroupSummary, PushMode } from "@/lib/actionPlans/types";
import { Copy, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CoachOption = {
  id: string;
  label: string;
};

type PushActionPlanModalProps = {
  open: boolean;
  templateTitle: string;
  templateId: string;
  accessToken: string;
  onClose: () => void;
  onPushed: () => void;
};

export function PushActionPlanModal({
  open,
  templateTitle,
  templateId,
  accessToken,
  onClose,
  onPushed,
}: PushActionPlanModalProps) {
  const [mode, setMode] = useState<PushMode>("all");
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [groups, setGroups] = useState<CoachGroupSummary[]>([]);
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [coachSearch, setCoachSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [shareCoachUrl, setShareCoachUrl] = useState<string | null>(null);
  const [shareAdminUrl, setShareAdminUrl] = useState<string | null>(null);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadShareLink = useCallback(async () => {
    setShareLinkLoading(true);
    setShareLinkError(null);
    try {
      const shareRes = await fetch(`/api/admin/action-plans/${templateId}/share-link`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const shareData = (await shareRes.json()) as {
        error?: string;
        coachUrl?: string;
        adminUrl?: string;
      };
      if (!shareRes.ok) {
        throw new Error(shareData.error ?? "Could not create share link.");
      }
      setShareCoachUrl(shareData.coachUrl ?? null);
      setShareAdminUrl(shareData.adminUrl ?? null);
    } catch (err) {
      setShareCoachUrl(null);
      setShareAdminUrl(null);
      setShareLinkError(
        err instanceof Error ? err.message : "Could not create share link.",
      );
    } finally {
      setShareLinkLoading(false);
    }
  }, [accessToken, templateId]);

  useEffect(() => {
    if (!open) return;
    setMode("all");
    setSelectedCoachIds([]);
    setSelectedGroupIds([]);
    setCoachSearch("");
    setError(null);
    setResultMessage(null);
    setCopied(null);
    setShareCoachUrl(null);
    setShareAdminUrl(null);
    setShareLinkError(null);

    let cancelled = false;
    async function load() {
      setLoading(true);
      void loadShareLink();
      try {
        const [coachesRes, groupsRes] = await Promise.all([
          fetch("/api/admin/coaches", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch("/api/admin/coach-groups", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);
        if (!coachesRes.ok || !groupsRes.ok) {
          throw new Error("Failed to load coaches or groups.");
        }
        const coachesData = (await coachesRes.json()) as {
          coaches?: Array<{
            id: string;
            full_name?: string | null;
            coach_business_name?: string | null;
            slug?: string;
          }>;
        };
        const groupsData = (await groupsRes.json()) as { groups?: CoachGroupSummary[] };
        if (cancelled) return;
        setCoaches(
          (coachesData.coaches ?? []).map((coach) => ({
            id: coach.id,
            label:
              coach.coach_business_name ||
              coach.full_name ||
              coach.slug ||
              coach.id,
          })),
        );
        setGroups(groupsData.groups ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadShareLink, open, accessToken, templateId]);

  const filteredCoaches = useMemo(() => {
    const q = coachSearch.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((coach) => coach.label.toLowerCase().includes(q));
  }, [coachSearch, coaches]);

  const recipientPreview = useMemo(() => {
    if (mode === "all") return coaches.length;
    if (mode === "coaches") return selectedCoachIds.length;
    const groupCoachCount = groups
      .filter((group) => selectedGroupIds.includes(group.id))
      .reduce((sum, group) => sum + group.memberCount, 0);
    return groupCoachCount;
  }, [coaches.length, groups, mode, selectedCoachIds.length, selectedGroupIds]);

  const toggleCoach = (coachId: string) => {
    setSelectedCoachIds((prev) =>
      prev.includes(coachId) ? prev.filter((id) => id !== coachId) : [...prev, coachId],
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const copyText = async (label: string, value: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Could not copy link.");
    }
  };

  const handlePush = async () => {
    setPushing(true);
    setError(null);
    setResultMessage(null);
    try {
      const res = await fetch(`/api/admin/action-plans/${templateId}/push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          coachIds: mode === "coaches" ? selectedCoachIds : undefined,
          groupIds: mode === "groups" ? selectedGroupIds : undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        result?: { assigned: string[]; skipped: string[]; failed: Array<{ coachId: string }> };
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Invite failed.");
      }
      const invited = data.result?.assigned.length ?? 0;
      const skipped = data.result?.skipped.length ?? 0;
      const failed = data.result?.failed.length ?? 0;
      setResultMessage(
        `Invited ${invited} coach${invited === 1 ? "" : "es"}. Skipped ${skipped}. Failed ${failed}. They can preview and accept in My Actions.`,
      );
      onPushed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setPushing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Share action plan</h2>
            <p className="text-sm text-slate-500">{templateTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Zoom / live link</h3>
            <p className="mt-1 text-sm text-slate-600">
              Share this link on a call. When someone is logged in, it opens My Actions with a
              preview they can accept or decline.
            </p>
            {shareCoachUrl ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareCoachUrl}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => void copyText("coach", shareCoachUrl)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied === "coach" ? "Copied" : "Copy"}
                  </button>
                </div>
                {shareAdminUrl ? (
                  <p className="text-xs text-slate-500">
                    Test as yourself:{" "}
                    <a href={shareAdminUrl} className="font-medium text-sky-700 hover:underline">
                      open admin My Actions preview
                    </a>
                  </p>
                ) : null}
              </div>
            ) : shareLinkLoading ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading share link…
              </p>
            ) : shareLinkError ? (
              <div className="mt-3 space-y-2">
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {shareLinkError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadShareLink()}
                  className="text-xs font-medium text-sky-700 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void loadShareLink()}
                className="mt-2 text-xs font-medium text-sky-700 hover:underline"
              >
                Generate share link
              </button>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Or invite in-app</h3>
            <p className="mt-1 text-sm text-slate-600">
              Sends a pending offer to their My Actions tab — nothing is added until they accept.
            </p>
          </section>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading coaches and groups…
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">Send to</legend>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="push-mode"
                checked={mode === "all"}
                onChange={() => setMode("all")}
              />
              All member coaches ({coaches.length})
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="push-mode"
                checked={mode === "coaches"}
                onChange={() => setMode("coaches")}
              />
              Selected coaches
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="push-mode"
                checked={mode === "groups"}
                onChange={() => setMode("groups")}
              />
              Coach groups
            </label>
          </fieldset>

          {mode === "coaches" ? (
            <div className="space-y-2">
              <input
                value={coachSearch}
                onChange={(e) => setCoachSearch(e.target.value)}
                placeholder="Search coaches…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                {filteredCoaches.map((coach) => (
                  <label
                    key={coach.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCoachIds.includes(coach.id)}
                      onChange={() => toggleCoach(coach.id)}
                    />
                    {coach.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {mode === "groups" ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
              {groups.length ? (
                groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex cursor-pointer items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                      />
                      {group.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                    </span>
                  </label>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-slate-500">
                  No groups yet. Create one under Coach groups.
                </p>
              )}
            </div>
          ) : null}

          <p className="text-sm text-slate-600">
            Recipients: <strong>{recipientPreview}</strong>
          </p>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
          {resultMessage ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {resultMessage}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={
              pushing ||
              loading ||
              (mode === "coaches" && !selectedCoachIds.length) ||
              (mode === "groups" && !selectedGroupIds.length)
            }
            onClick={() => void handlePush()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send invitations
          </button>
        </div>
      </div>
    </div>
  );
}
