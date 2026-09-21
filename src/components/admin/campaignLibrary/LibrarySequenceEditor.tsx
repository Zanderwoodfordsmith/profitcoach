"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, SlidersHorizontal } from "lucide-react";
import {
  CampaignSequenceBuilder,
  EMPTY_STEP_PEOPLE,
  type SequenceStep,
} from "@/components/campaigns/CampaignSequenceBuilder";
import { LibraryTemplateSettingsModal } from "@/components/admin/campaignLibrary/LibraryTemplateSettingsModal";
import { campaignLibraryAuthHeaders } from "@/lib/campaignLibrary/authHeaders";
import { defaultLibraryTemplateSettings } from "@/lib/campaignLibrary/sanitize";
import {
  CAMPAIGN_LIBRARY_KIND_LABEL,
  CAMPAIGN_LIBRARY_KINDS,
  libraryListHref,
  type CampaignLibraryItemDetail,
  type CampaignLibraryKind,
  type CampaignLibraryTemplateSettings,
} from "@/lib/campaignLibrary/types";
import {
  campaignStepHasCopy,
  defaultStepConfig,
  type CampaignStepMediaKind,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import { duplicateCampaignStep } from "@/lib/unipile/campaignStepDuplicate";

function asSettings(
  item: CampaignLibraryItemDetail
): CampaignLibraryTemplateSettings {
  if (item.item_type !== "template") return defaultLibraryTemplateSettings();
  const raw = item.settings as Partial<CampaignLibraryTemplateSettings>;
  return {
    ...defaultLibraryTemplateSettings(),
    ...raw,
    send_rules:
      raw.send_rules && raw.send_rules.length > 0
        ? raw.send_rules
        : defaultLibraryTemplateSettings().send_rules,
  };
}

export function LibrarySequenceEditor({
  itemId,
  expectedType,
}: {
  itemId: string;
  expectedType: "template" | "sequence";
}) {
  const [item, setItem] = useState<CampaignLibraryItemDetail | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const stepsRef = useRef<SequenceStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CampaignLibraryTemplateSettings>(
    defaultLibraryTemplateSettings()
  );

  const load = useCallback(async () => {
    const headers = await campaignLibraryAuthHeaders();
    if (!headers) throw new Error("Sign in required.");
    const res = await fetch(
      `/api/admin/campaign-library/${encodeURIComponent(itemId)}`,
      { headers }
    );
    const body = (await res.json()) as {
      error?: string;
      item?: CampaignLibraryItemDetail;
    };
    if (!res.ok || !body.item) {
      throw new Error(body.error || "Not found.");
    }
    if (body.item.item_type !== expectedType) {
      throw new Error("Not found.");
    }
    setItem(body.item);
    setNameDraft(body.item.name);
    setSettings(asSettings(body.item));
    const nextSteps = body.item.steps as SequenceStep[];
    stepsRef.current = nextSteps;
    setSteps(nextSteps);
  }, [expectedType, itemId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void load()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function patchItem(payload: Record<string, unknown>) {
    const headers = await campaignLibraryAuthHeaders();
    if (!headers) throw new Error("Sign in required.");
    const res = await fetch(
      `/api/admin/campaign-library/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      }
    );
    const body = (await res.json()) as {
      error?: string;
      item?: CampaignLibraryItemDetail;
    };
    if (!res.ok || !body.item) {
      throw new Error(body.error || "Could not save.");
    }
    setItem(body.item);
    setNameDraft(body.item.name);
    setSettings(asSettings(body.item));
  }

  async function saveSteps(next: SequenceStep[]) {
    setBusy(true);
    setError(null);
    try {
      const headers = await campaignLibraryAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/admin/campaign-library/${encodeURIComponent(itemId)}/steps`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ steps: next }),
        }
      );
      const body = (await res.json()) as {
        error?: string;
        steps?: SequenceStep[];
      };
      if (!res.ok) throw new Error(body.error || "Could not save steps.");
      const saved = (body.steps ?? next) as SequenceStep[];
      stepsRef.current = saved;
      setSteps(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save steps.");
    } finally {
      setBusy(false);
    }
  }

  function addStep(
    type: CampaignStepType,
    atIndex?: number,
    mediaKind?: CampaignStepMediaKind
  ) {
    const insertAt = Math.max(0, Math.min(atIndex ?? steps.length, steps.length));
    const created: SequenceStep = {
      position: insertAt,
      step_type: type,
      body: campaignStepHasCopy(type) ? "" : null,
      wait_hours: type === "wait" ? 24 : null,
      send_mode: "auto",
      fallback_hours: null,
      fallback_body: null,
      config: {
        ...defaultStepConfig(type),
        ...(mediaKind ? { media_kind: mediaKind } : {}),
      },
    };
    const next = [...steps.slice(0, insertAt), created, ...steps.slice(insertAt)].map(
      (step, i) => ({ ...step, position: i })
    );
    stepsRef.current = next;
    setSteps(next);
    void saveSteps(next);
  }

  function patchStep(index: number, patch: Partial<SequenceStep>) {
    const next = stepsRef.current.map((step, i) =>
      i === index ? { ...step, ...patch } : step
    );
    stepsRef.current = next;
    setSteps(next);
  }

  function commitSteps() {
    void saveSteps(stepsRef.current);
  }

  function deleteStep(index: number) {
    const next = steps
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, position: i }));
    stepsRef.current = next;
    setSteps(next);
    void saveSteps(next);
  }

  function duplicateStep(index: number) {
    const next = duplicateCampaignStep(stepsRef.current, index);
    if (next === stepsRef.current) return;
    stepsRef.current = next;
    setSteps(next);
    void saveSteps(next);
  }

  function reorderSteps(next: SequenceStep[]) {
    stepsRef.current = next;
    setSteps(next);
    void saveSteps(next);
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!item || next === item.name) {
      setEditingName(false);
      setNameDraft(item?.name ?? "");
      return;
    }
    try {
      await patchItem({ name: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name.");
    } finally {
      setEditingName(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (!item) {
    return (
      <p className="text-sm text-rose-700">{error ?? "Not found."}</p>
    );
  }

  const backHref = libraryListHref(item.item_type);
  const showSettings = item.item_type === "template";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Library
          </Link>
          <div className="mt-2 flex items-center gap-2">
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveName();
                  }
                  if (e.key === "Escape") {
                    setNameDraft(item.name);
                    setEditingName(false);
                  }
                }}
                className="w-full max-w-md rounded-lg border border-slate-200 px-2.5 py-1 text-lg font-semibold text-slate-900"
              />
            ) : (
              <>
                <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                  {item.name}
                </h1>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  aria-label="Edit name"
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-600">
            Kind
            <select
              value={item.kind}
              onChange={(e) =>
                void patchItem({
                  kind: e.target.value as CampaignLibraryKind,
                }).catch((err) =>
                  setError(err instanceof Error ? err.message : "Could not save.")
                )
              }
              className="ml-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              {CAMPAIGN_LIBRARY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {CAMPAIGN_LIBRARY_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={item.status === "published"}
            onClick={() =>
              void patchItem({
                status: item.status === "published" ? "draft" : "published",
              }).catch((err) =>
                setError(err instanceof Error ? err.message : "Could not save.")
              )
            }
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              item.status === "published"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.status === "published" ? "Ready" : "Draft"}
          </button>
          {showSettings ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              Settings
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="mt-4">
        <CampaignSequenceBuilder
          mode="library"
          steps={steps}
          campaignId={item.id}
          uploadUrl={`/api/admin/campaign-library/${encodeURIComponent(item.id)}/step-media`}
          peopleAtStep={() => EMPTY_STEP_PEOPLE}
          abStats={null}
          onAddStep={addStep}
          onPatchStep={patchStep}
          onCommitSteps={commitSteps}
          onDeleteStep={deleteStep}
          onDuplicateStep={duplicateStep}
          onReorderSteps={reorderSteps}
        />
      </div>

      {showSettings ? (
        <LibraryTemplateSettingsModal
          open={settingsOpen}
          settings={settings}
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
          onSave={() => {
            void patchItem({ settings })
              .then(() => setSettingsOpen(false))
              .catch((err) =>
                setError(err instanceof Error ? err.message : "Could not save.")
              );
          }}
        />
      ) : null}
    </div>
  );
}
