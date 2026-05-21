"use client";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { PushActionPlanModal } from "@/components/admin/PushActionPlanModal";
import { StickyPageHeader } from "@/components/layout";
import type { ActionPlanTemplateSummary } from "@/lib/actionPlans/types";
import { supabaseClient } from "@/lib/supabaseClient";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function AdminActionPlansPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ActionPlanTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pushTarget, setPushTarget] = useState<ActionPlanTemplateSummary | null>(null);

  const loadTemplates = useCallback(async (token: string) => {
    const res = await fetch("/api/admin/action-plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Failed to load action plans.");
    }
    const data = (await res.json()) as { templates?: ActionPlanTemplateSummary[] };
    setTemplates(data.templates ?? []);
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
        await loadTemplates(session.access_token);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load action plans.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadTemplates, router]);

  const createTemplate = async () => {
    if (!accessToken) return;
    const title = window.prompt("Action plan title");
    if (!title?.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/action-plans", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        template?: ActionPlanTemplateSummary;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to create plan.");
      if (data.template) {
        router.push(`/admin/action-plans/${data.template.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan.");
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (template: ActionPlanTemplateSummary) => {
    if (!accessToken) return;
    if (
      !window.confirm(
        `Delete "${template.title}"? This cannot be undone unless the plan has no active assignments.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/action-plans/${template.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete plan.");
      await loadTemplates(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan.");
    }
  };

  return (
    <>
      <StickyPageHeader
        title="Action plans"
        description="Design projects and actions, then push them to coaches."
        tabs={<CoachesHubTabs />}
      />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Templates appear in coaches&apos; My Actions tab when pushed.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/coach-groups"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Coach groups
            </Link>
            <button
              type="button"
              onClick={() => void createTemplate()}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              New plan
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading action plans…
          </div>
        ) : templates.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Avg complete</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/action-plans/${template.id}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {template.title}
                      </Link>
                      {template.description ? (
                        <p className="mt-1 text-xs text-slate-500">{template.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{template.itemCount}</td>
                    <td className="px-4 py-3 text-slate-700">{template.assignedCoachCount}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {template.completionPercent == null ? "—" : `${template.completionPercent}%`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPushTarget(template)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Push
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTemplate(template)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
            No action plans yet. Create one to get started.
          </div>
        )}
      </div>

      {pushTarget && accessToken ? (
        <PushActionPlanModal
          open
          templateId={pushTarget.id}
          templateTitle={pushTarget.title}
          accessToken={accessToken}
          onClose={() => setPushTarget(null)}
          onPushed={() => {
            if (accessToken) void loadTemplates(accessToken);
          }}
        />
      ) : null}
    </>
  );
}
