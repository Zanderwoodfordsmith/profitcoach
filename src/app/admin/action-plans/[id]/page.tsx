"use client";

import { ActionOutlineEditor } from "@/components/actionPlans/ActionOutlineEditor";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { PushActionPlanModal } from "@/components/admin/PushActionPlanModal";
import { StickyPageHeader } from "@/components/layout";
import { createOutlineLine } from "@/lib/actionPlans/actionOutlineUtils";
import type { ActionOutlineLine } from "@/lib/actionPlans/types";
import { supabaseClient } from "@/lib/supabaseClient";
import { ArrowLeft, Loader2, Save, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function AdminActionPlanEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const templateId = params.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ActionOutlineLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pushOpen, setPushOpen] = useState(false);
  const [invitations, setInvitations] = useState<
    Array<{
      id: string;
      coachId: string;
      coachName: string | null;
      status: string;
      invitedAt: string;
      respondedAt: string | null;
    }>
  >([]);
  const skipAutoSaveRef = useRef(true);

  const loadInvitations = useCallback(async (token: string) => {
    const res = await fetch(`/api/admin/action-plans/${templateId}/invitations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      invitations?: Array<{
        id: string;
        coachId: string;
        coachName: string | null;
        status: string;
        invitedAt: string;
        respondedAt: string | null;
      }>;
    };
    setInvitations(data.invitations ?? []);
  }, [templateId]);

  const loadPlan = useCallback(
    async (token: string) => {
      const res = await fetch(`/api/admin/action-plans/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to load action plan.");
      }
      const data = (await res.json()) as {
        template?: {
          title?: string;
          description?: string | null;
        };
        items?: ActionOutlineLine[];
      };
      setTitle(data.template?.title ?? "");
      setDescription(data.template?.description ?? "");
      skipAutoSaveRef.current = true;
      setItems(data.items?.length ? data.items : [createOutlineLine("", 0)]);
    },
    [templateId],
  );

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
        await Promise.all([
          loadPlan(session.access_token),
          loadInvitations(session.access_token),
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load action plan.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadInvitations, loadPlan, router]);

  const savePlan = useCallback(async () => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/action-plans/${templateId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          items,
        }),
      });
      const data = (await res.json()) as { error?: string; items?: ActionOutlineLine[] };
      if (!res.ok) throw new Error(data.error ?? "Failed to save action plan.");
      if (data.items) {
        skipAutoSaveRef.current = true;
        setItems(data.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save action plan.");
    } finally {
      setSaving(false);
    }
  }, [accessToken, description, items, templateId, title]);

  useEffect(() => {
    if (loading || skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void savePlan();
    }, 800);
    return () => clearTimeout(timer);
  }, [items, title, description, loading, savePlan]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading plan…
      </div>
    );
  }

  return (
    <>
      <StickyPageHeader
        title="Edit action plan"
        description="Coaches preview and accept before items appear in My Actions. Share a Zoom link or send in-app invitations."
        tabs={<CoachesHubTabs />}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="mb-0 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/action-plans"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to action plans
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void savePlan()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setPushOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              <Send className="h-4 w-4" />
              Share / invite
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
          </label>
        </div>

        {invitations.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Invitation responses</h2>
              <p className="text-xs text-slate-500">
                Pending coaches can preview in My Actions. Accepted plans become assigned action items.
              </p>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Coach</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Invited</th>
                  <th className="px-4 py-2">Responded</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-800">
                      {row.coachName ?? row.coachId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2 capitalize text-slate-700">{row.status}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {new Date(row.invitedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.respondedAt
                        ? new Date(row.respondedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <ActionOutlineEditor
          items={items}
          onItemsChange={setItems}
          mode="template"
          showAutoCompleteRule
          emptyMessage="Add a project and actions for this plan."
        />
      </div>

      {pushOpen && accessToken ? (
        <PushActionPlanModal
          open
          templateId={templateId}
          templateTitle={title || "Untitled plan"}
          accessToken={accessToken}
          onClose={() => setPushOpen(false)}
          onPushed={() => {
            setPushOpen(false);
            if (accessToken) void loadInvitations(accessToken);
          }}
        />
      ) : null}
    </>
  );
}
