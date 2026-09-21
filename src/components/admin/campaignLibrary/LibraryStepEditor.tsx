"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  StepInlineEditor,
  type SequenceStep,
} from "@/components/campaigns/CampaignSequenceBuilder";
import { campaignLibraryAuthHeaders } from "@/lib/campaignLibrary/authHeaders";
import { blankSequenceStep, toSequenceStep } from "@/lib/campaignLibrary/sequenceStep";
import {
  CAMPAIGN_LIBRARY_KIND_LABEL,
  CAMPAIGN_LIBRARY_KINDS,
  libraryListHref,
  type CampaignLibraryItemDetail,
  type CampaignLibraryKind,
} from "@/lib/campaignLibrary/types";
import {
  CAMPAIGN_STEP_TYPES,
  campaignStepHasCopy,
  campaignStepTypeLabel,
  defaultStepConfig,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";

const STEP_TYPES = CAMPAIGN_STEP_TYPES.filter(
  (type) => type !== "add_to_campaign"
);

function asSingleStep(item: CampaignLibraryItemDetail): SequenceStep {
  const step = item.steps[0];
  return step ? toSequenceStep(step) : blankSequenceStep();
}

export function LibraryStepEditor({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<CampaignLibraryItemDetail | null>(null);
  const [step, setStep] = useState<SequenceStep>(blankSequenceStep());
  const stepRef = useRef(step);
  stepRef.current = step;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

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
    if (body.item.item_type !== "step") {
      throw new Error("Not found.");
    }
    setItem(body.item);
    setNameDraft(body.item.name);
    const nextStep = asSingleStep(body.item);
    stepRef.current = nextStep;
    setStep(nextStep);
  }, [itemId]);

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
  }

  async function saveStep(next: SequenceStep) {
    const headers = await campaignLibraryAuthHeaders();
    if (!headers) throw new Error("Sign in required.");
    const res = await fetch(
      `/api/admin/campaign-library/${encodeURIComponent(itemId)}/steps`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ steps: [{ ...next, position: 0 }] }),
      }
    );
    const body = (await res.json()) as {
      error?: string;
      steps?: SequenceStep[];
    };
    if (!res.ok) throw new Error(body.error || "Could not save step.");
    const saved = body.steps?.[0];
    if (saved) {
      stepRef.current = saved;
      setStep(saved);
    }
  }

  function changeType(type: CampaignStepType) {
    const next: SequenceStep = {
      ...step,
      step_type: type,
      body: campaignStepHasCopy(type) ? step.body ?? "" : null,
      wait_hours: type === "wait" ? step.wait_hours ?? 24 : null,
      send_mode: type === "message" ? step.send_mode ?? "auto" : "auto",
      variants: [],
      config: defaultStepConfig(type),
    };
    setStep(next);
    stepRef.current = next;
    void saveStep(next).catch((err) =>
      setError(err instanceof Error ? err.message : "Could not save.")
    );
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
    return <p className="text-sm text-rose-700">{error ?? "Not found."}</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="min-w-0">
          <Link
            href={libraryListHref("step")}
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
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="mx-auto mt-6 max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">
          Step type
          <select
            value={step.step_type}
            onChange={(e) => changeType(e.target.value as CampaignStepType)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {STEP_TYPES.map((type) => (
              <option key={type} value={type}>
                {campaignStepTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <StepInlineEditor
          step={step}
          campaignId={item.id}
          uploadUrl={`/api/admin/campaign-library/${encodeURIComponent(item.id)}/step-media`}
          libraryMode
          abStats={null}
          campaigns={[]}
          onChange={(patch) => {
            const next = { ...stepRef.current, ...patch };
            stepRef.current = next;
            setStep(next);
          }}
          onCommit={() => {
            void saveStep(stepRef.current).catch((err) =>
              setError(err instanceof Error ? err.message : "Could not save.")
            );
          }}
        />
      </div>
    </div>
  );
}
