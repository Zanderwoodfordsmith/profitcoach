"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { avaWorkFor, missingLabel } from "@/lib/launch/avaWork";
import { overlayDrafts, type OpenDraft } from "@/lib/launch/draftOverlay";
import type { ActivityItem, AnswerFill } from "@/lib/launch/jobActivity";
import type { FieldSpec } from "@/lib/practiceKnowledge/blueprint";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";

import { PracticeContext, usePractice, type PracticeContextValue } from "./PracticeProvider";

/**
 * Ava's drafts in place on a coach's Blueprint, for BCA only (job 248, 21 Nov).
 * Every box and written section on the page shows Ava's open draft; typing in
 * one changes the draft, never the live Blueprint. The coach still sees only
 * what has been released. The page's bar (DraftBar) releases it.
 */

export type DraftMissing = { label: string; coach: boolean };

type DraftLayerValue = {
  scope: string;
  /** The open drafts on this page (written sections, Ava's answers, the LinkedIn profile). */
  items: ActivityItem[];
  /** Section keys and answer paths showing Ava's draft. */
  draftKeys: Set<string>;
  draftPaths: Set<string>;
  missing: DraftMissing[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** POST to the launch actions as BCA; null when it worked, else the problem. */
  post: (body: Record<string, unknown>) => Promise<string | null>;
};

const DraftLayerContext = createContext<DraftLayerValue | null>(null);

/** The draft layer, when an admin is on a coach's page with something of Ava's waiting. */
export function useDraftLayer(): DraftLayerValue | null {
  return useContext(DraftLayerContext);
}

function answerText(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join("\n") : String(value ?? "");
}

export function DraftLayer({ page, children }: { page: string; children: ReactNode }) {
  const ctx = usePractice();
  const { coachId, sample, viewer, knowledge, payload, authHeaders } = ctx;
  const enabled = viewer === "bca" && Boolean(coachId) && !sample;
  const scope = `page:${page}`;
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  const post = useCallback(
    async (body: Record<string, unknown>): Promise<string | null> => {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/launch/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ coachId, ...body }),
      }).catch(() => null);
      if (res?.ok) return null;
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      return data?.error ?? "Something went wrong. Try again.";
    },
    [authHeaders, coachId]
  );

  const fetchItems = useCallback(async (): Promise<ActivityItem[]> => {
    if (!enabled || !coachId) return [];
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/launch/activity?coachId=${encodeURIComponent(coachId)}&job=${encodeURIComponent(scope)}`, {
      headers: headers ?? {},
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { items?: ActivityItem[] } | null;
    return (data?.items ?? []).filter((item) => item.status === "open" && (item.kind === "draft" || item.kind === "answers"));
  }, [enabled, coachId, authHeaders, scope]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setItems(await fetchItems());
    setLoading(false);
  }, [fetchItems]);

  useEffect(() => {
    let alive = true;
    void fetchItems().then((next) => {
      if (alive) setItems(next);
    });
    return () => {
      alive = false;
    };
  }, [fetchItems]);

  const value = useMemo((): { practice: PracticeContextValue; layer: DraftLayerValue } | null => {
    if (!enabled || !knowledge || !payload || !items.length) return null;
    const drafts = items as unknown as OpenDraft[];
    const row = overlayDrafts({ ...knowledge, payload }, drafts);
    const answersItem = items.find((item) => item.kind === "answers") ?? null;
    const sectionsItem = items.find((item) => item.kind === "draft" && !item.payload.linkedinParts) ?? null;
    const draftKeys = new Set((sectionsItem?.payload.sections ?? []).map((s) => s.key));
    const draftPaths = new Set(((answersItem?.payload.answers ?? []) as AnswerFill[]).filter((a) => a.value?.trim()).map((a) => a.path));
    // What Ava wrote without, worked out the way she did (her own drafts on this page left out).
    const missing = avaWorkFor(scope, overlayDrafts({ ...knowledge, payload }, drafts, [scope])).missing.map((m) => ({
      label: missingLabel(m, scope),
      coach: m.coach,
    }));

    const saveField = (field: FieldSpec, next: unknown) => {
      if (answersItem && draftPaths.has(field.path)) {
        void post({ action: "edit_answer", id: answersItem.id, path: field.path, text: answerText(next) }).then(() => refresh());
        return;
      }
      ctx.saveField(field, next);
    };
    const saveBlocks = async (key: string, blocks: BlueprintBlock[]) => {
      if (sectionsItem && draftKeys.has(key)) {
        const err = await post({ action: "edit", id: sectionsItem.id, key, blocks });
        await refresh();
        return !err;
      }
      return ctx.saveBlocks(key, blocks);
    };

    return {
      practice: { ...ctx, payload: row.payload, knowledge: { ...knowledge, payload: row.payload, built_sections: row.built_sections }, saveField, saveBlocks },
      layer: { scope, items, draftKeys, draftPaths, missing, loading, refresh, post },
    };
  }, [enabled, knowledge, payload, items, ctx, scope, post, refresh, loading]);

  if (!value) {
    // Nothing of Ava's waiting here: the page as it is, plus the layer so the bar can still show (and refresh after a run).
    return (
      <DraftLayerContext.Provider
        value={enabled ? { scope, items, draftKeys: new Set(), draftPaths: new Set(), missing: [], loading, refresh, post } : null}
      >
        {children}
      </DraftLayerContext.Provider>
    );
  }
  return (
    <DraftLayerContext.Provider value={value.layer}>
      <PracticeContext.Provider value={value.practice}>{children}</PracticeContext.Provider>
    </DraftLayerContext.Provider>
  );
}
