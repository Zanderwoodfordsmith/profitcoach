import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";
import { mediaFromStepConfig, signCampaignStepMedia } from "@/lib/unipile/campaignStepMedia";
import {
  blankLibraryMessageStep,
  normalizeLibraryName,
  normalizeLibrarySteps,
  sanitizeLibraryItemSettings,
} from "@/lib/campaignLibrary/sanitize";
import {
  DEFAULT_LIBRARY_ITEM_NAME,
  type CampaignLibraryItemDetail,
  type CampaignLibraryItemSummary,
  type CampaignLibraryItemType,
  type CampaignLibraryKind,
  type CampaignLibraryStatus,
  type CampaignLibraryTemplateSettings,
} from "@/lib/campaignLibrary/types";

type ItemRow = {
  id: string;
  item_type: CampaignLibraryItemType;
  kind: CampaignLibraryKind;
  name: string;
  description: string | null;
  settings: unknown;
  status: CampaignLibraryStatus;
  created_at: string;
  updated_at: string;
};

type StepRow = {
  id: string;
  item_id: string;
  position: number;
  step_type: string;
  body: string | null;
  wait_hours: number | null;
  variants: unknown;
  send_mode: string | null;
  fallback_hours: number | null;
  fallback_body: string | null;
  config: unknown;
};

const ITEM_SELECT =
  "id, item_type, kind, name, description, settings, status, created_at, updated_at";

function asSettings(
  itemType: CampaignLibraryItemType,
  raw: unknown
): CampaignLibraryTemplateSettings | Record<string, never> {
  return sanitizeLibraryItemSettings(itemType, raw);
}

function stepInputFromRow(row: StepRow): CampaignStepInput {
  return {
    id: row.id,
    position: row.position,
    step_type: row.step_type as CampaignStepInput["step_type"],
    body: row.body,
    wait_hours: row.wait_hours == null ? null : Number(row.wait_hours),
    variants: Array.isArray(row.variants)
      ? (row.variants as CampaignStepInput["variants"])
      : [],
    send_mode: row.send_mode === "remind" ? "remind" : "auto",
    fallback_hours:
      row.fallback_hours == null ? null : Number(row.fallback_hours),
    fallback_body: row.fallback_body,
    config:
      row.config && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {},
  };
}

function summaryFrom(
  row: ItemRow,
  steps: Array<{ step_type: string }>
): CampaignLibraryItemSummary {
  const stepTypes = steps.map((step) => step.step_type);
  return {
    id: row.id,
    item_type: row.item_type,
    kind: row.kind,
    name: row.name,
    description: row.description,
    status: row.status,
    settings: asSettings(row.item_type, row.settings),
    step_count: steps.length,
    step_types: stepTypes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadStepTypesByItem(
  itemIds: string[]
): Promise<Map<string, string[]>> {
  const byItem = new Map<string, string[]>();
  if (itemIds.length === 0) return byItem;
  const { data, error } = await supabaseAdmin
    .from("campaign_library_steps")
    .select("item_id, step_type")
    .in("item_id", itemIds)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = row.item_id as string;
    const list = byItem.get(id) ?? [];
    list.push(String(row.step_type ?? ""));
    byItem.set(id, list);
  }
  return byItem;
}

async function loadSteps(itemId: string): Promise<StepRow[]> {
  const { data, error } = await supabaseAdmin
    .from("campaign_library_steps")
    .select(
      "id, item_id, position, step_type, body, wait_hours, variants, send_mode, fallback_hours, fallback_body, config"
    )
    .eq("item_id", itemId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StepRow[];
}

async function signStepInputs(
  steps: CampaignStepInput[]
): Promise<CampaignStepInput[]> {
  return Promise.all(
    steps.map(async (step) => {
      const media = mediaFromStepConfig(step.config);
      if (!media) return step;
      const signed = await signCampaignStepMedia(media);
      return {
        ...step,
        config: {
          ...((step.config as Record<string, unknown> | null) ?? {}),
          media: signed,
        },
      };
    })
  );
}

function insertRowsFor(
  itemId: string,
  steps: CampaignStepInput[]
): Array<Record<string, unknown>> {
  return steps.map((step) => ({
    item_id: itemId,
    position: step.position,
    step_type: step.step_type,
    body: step.body ?? null,
    wait_hours: step.wait_hours ?? null,
    variants: step.variants ?? [],
    send_mode: step.send_mode ?? "auto",
    fallback_hours: step.fallback_hours ?? null,
    fallback_body: step.fallback_body ?? null,
    config: step.config ?? {},
  }));
}

export async function listLibraryItems(input: {
  itemType: CampaignLibraryItemType;
  kind?: CampaignLibraryKind | null;
}): Promise<CampaignLibraryItemSummary[]> {
  try {
    const { ensureCampaignLibrarySeeds } = await import(
      "@/lib/campaignLibrary/seeds"
    );
    await ensureCampaignLibrarySeeds();
  } catch (err) {
    console.error("ensureCampaignLibrarySeeds:", err);
  }

  let query = supabaseAdmin
    .from("campaign_library_items")
    .select(ITEM_SELECT)
    .eq("item_type", input.itemType)
    .order("updated_at", { ascending: false });
  if (input.kind) query = query.eq("kind", input.kind);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ItemRow[];
  const stepTypes = await loadStepTypesByItem(rows.map((row) => row.id));
  return rows.map((row) =>
    summaryFrom(
      row,
      (stepTypes.get(row.id) ?? []).map((step_type) => ({ step_type }))
    )
  );
}

export async function getLibraryItem(
  id: string
): Promise<CampaignLibraryItemDetail | null> {
  const { data, error } = await supabaseAdmin
    .from("campaign_library_items")
    .select(ITEM_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ItemRow;
  const stepRows = await loadSteps(id);
  const steps = await signStepInputs(stepRows.map(stepInputFromRow));
  return {
    ...summaryFrom(row, stepRows),
    steps,
  };
}

export async function createLibraryItem(input: {
  itemType: CampaignLibraryItemType;
  name?: string;
  kind: CampaignLibraryKind;
  createdBy: string;
}): Promise<CampaignLibraryItemDetail> {
  const name = normalizeLibraryName(input.itemType, input.name);
  const settings = sanitizeLibraryItemSettings(input.itemType, {});
  const { data, error } = await supabaseAdmin
    .from("campaign_library_items")
    .insert({
      item_type: input.itemType,
      kind: input.kind,
      name,
      description: null,
      settings,
      status: "draft",
      created_by: input.createdBy,
    })
    .select(ITEM_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const row = data as ItemRow;
  if (input.itemType === "step") {
    await replaceLibrarySteps(row.id, [blankLibraryMessageStep()]);
  }
  const detail = await getLibraryItem(row.id);
  if (!detail) throw new Error("Failed to load created library item.");
  return detail;
}

export async function updateLibraryItem(
  id: string,
  patch: {
    name?: string;
    kind?: CampaignLibraryKind;
    description?: string | null;
    status?: CampaignLibraryStatus;
    settings?: unknown;
  }
): Promise<CampaignLibraryItemDetail | null> {
  const existing = await getLibraryItem(id);
  if (!existing) return null;
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    update.name = normalizeLibraryName(existing.item_type, patch.name);
  }
  if (patch.kind) update.kind = patch.kind;
  if (patch.description !== undefined) {
    update.description =
      typeof patch.description === "string" && patch.description.trim()
        ? patch.description.trim()
        : null;
  }
  if (patch.status) update.status = patch.status;
  if (patch.settings !== undefined) {
    update.settings = sanitizeLibraryItemSettings(
      existing.item_type,
      patch.settings
    );
  }
  if (Object.keys(update).length === 0) return existing;
  const { error } = await supabaseAdmin
    .from("campaign_library_items")
    .update(update)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return getLibraryItem(id);
}

export async function deleteLibraryItem(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("campaign_library_items")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function replaceLibrarySteps(
  itemId: string,
  steps: CampaignStepInput[]
): Promise<CampaignStepInput[]> {
  const { data: item, error: itemError } = await supabaseAdmin
    .from("campaign_library_items")
    .select("item_type")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item) throw new Error("Not found.");
  const itemType = item.item_type as CampaignLibraryItemType;
  const cleaned = normalizeLibrarySteps(itemType, steps);

  const { error: delErr } = await supabaseAdmin
    .from("campaign_library_steps")
    .delete()
    .eq("item_id", itemId);
  if (delErr) throw new Error(delErr.message);

  if (cleaned.length === 0) {
    await supabaseAdmin
      .from("campaign_library_items")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", itemId);
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("campaign_library_steps")
    .insert(insertRowsFor(itemId, cleaned))
    .select(
      "id, item_id, position, step_type, body, wait_hours, variants, send_mode, fallback_hours, fallback_body, config"
    )
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("campaign_library_items")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", itemId);

  return signStepInputs(((data ?? []) as StepRow[]).map(stepInputFromRow));
}

export async function duplicateLibraryItem(
  id: string
): Promise<CampaignLibraryItemDetail | null> {
  const source = await getLibraryItem(id);
  if (!source) return null;
  const { data, error } = await supabaseAdmin
    .from("campaign_library_items")
    .insert({
      item_type: source.item_type,
      kind: source.kind,
      name: `Copy of ${source.name || DEFAULT_LIBRARY_ITEM_NAME[source.item_type]}`,
      description: source.description,
      settings: sanitizeLibraryItemSettings(source.item_type, source.settings),
      status: "draft",
      created_by: null,
    })
    .select(ITEM_SELECT)
    .single();
  if (error) throw new Error(error.message);
  const copy = data as ItemRow;
  const steps = source.steps.map((step) => {
    const { id: _id, ...rest } = step;
    return rest;
  });
  await replaceLibrarySteps(copy.id, steps);
  return getLibraryItem(copy.id);
}

export const LIBRARY_MEDIA_COACH_ID = "library";

export function libraryStepMediaFolder(itemId: string): string {
  return itemId;
}

export function isOwnedLibraryStepMediaPath(
  itemId: string,
  path: string
): boolean {
  const prefix = `${LIBRARY_MEDIA_COACH_ID}/${itemId}/`;
  return path.startsWith(prefix) && !path.includes("..");
}
