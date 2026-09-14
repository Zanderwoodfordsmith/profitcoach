import {
  createDefaultPoolTableViewSettings,
  createPoolTableView,
  DEFAULT_POOL_TABLE_VIEW_NAME,
  isDefaultProspectTableViewName,
  MAX_POOL_TABLE_VIEW_NAME_LENGTH,
  MAX_POOL_TABLE_VIEW_SETTINGS_BYTES,
  normalizePoolTableViewSettings,
  orderPoolTableViews,
  POOL_TABLE_VIEW_SURFACE,
  type PoolTableView,
  type PoolTableViewSettings,
  type PoolTableViewsPayload,
} from "@/lib/pool/poolTableViews";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SURFACE = POOL_TABLE_VIEW_SURFACE;

type ViewRow = {
  id: string;
  owner_id: string;
  surface: string;
  name: string;
  settings: unknown;
  created_at: string;
  updated_at: string;
};

type PrefsRow = {
  user_id: string;
  surface: string;
  active_view_id: string | null;
  autosave: boolean;
  view_order: string[] | null;
};

function mapViewRow(row: ViewRow): PoolTableView {
  const isAll = isDefaultProspectTableViewName(row.name);
  return createPoolTableView(
    isAll ? DEFAULT_POOL_TABLE_VIEW_NAME : row.name,
    normalizePoolTableViewSettings(row.settings),
    {
      id: row.id,
      createdBy: row.owner_id,
      canEdit: true,
    }
  );
}

function normalizeViewOrder(
  viewOrder: unknown,
  visibleIds: Set<string>,
  allViewId: string | null
): string[] {
  const raw = Array.isArray(viewOrder)
    ? viewOrder.filter((id): id is string => typeof id === "string")
    : [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of raw) {
    if (allViewId && id === allViewId) continue;
    if (!visibleIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const id of visibleIds) {
    if (allViewId && id === allViewId) continue;
    if (seen.has(id)) continue;
    ordered.push(id);
  }
  return ordered;
}

function assertViewName(name: string, { allowAll }: { allowAll: boolean }): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("View name is required.");
  if (trimmed.length > MAX_POOL_TABLE_VIEW_NAME_LENGTH) {
    throw new Error("View name is too long.");
  }
  if (!allowAll && isDefaultProspectTableViewName(trimmed)) {
    throw new Error('Reserved view name "All". Choose another name.');
  }
  return trimmed;
}

function assertSettings(settings: unknown): PoolTableViewSettings {
  if (!settings || typeof settings !== "object") {
    throw new Error("Invalid view settings.");
  }
  const encoded = JSON.stringify(settings);
  if (encoded.length > MAX_POOL_TABLE_VIEW_SETTINGS_BYTES) {
    throw new Error("View settings are too large.");
  }
  return normalizePoolTableViewSettings(settings);
}

async function loadPreferences(userId: string): Promise<PrefsRow | null> {
  const { data, error } = await supabaseAdmin
    .from("prospect_table_view_preferences")
    .select("user_id, surface, active_view_id, autosave, view_order")
    .eq("user_id", userId)
    .eq("surface", SURFACE)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PrefsRow | null) ?? null;
}

async function upsertPreferences(input: {
  userId: string;
  activeViewId: string | null;
  autosave: boolean;
  viewOrder: string[];
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("prospect_table_view_preferences")
    .upsert(
      {
        user_id: input.userId,
        surface: SURFACE,
        active_view_id: input.activeViewId,
        autosave: input.autosave,
        view_order: input.viewOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,surface" }
    );
  if (error) throw new Error(error.message);
}

async function loadOwnerViewRows(ownerId: string): Promise<ViewRow[]> {
  const { data, error } = await supabaseAdmin
    .from("prospect_table_views")
    .select("id, owner_id, surface, name, settings, created_at, updated_at")
    .eq("owner_id", ownerId)
    .eq("surface", SURFACE)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ViewRow[];
}

async function ensureOwnerAllView(
  rows: ViewRow[],
  ownerId: string
): Promise<ViewRow[]> {
  const allRows = rows.filter((row) => isDefaultProspectTableViewName(row.name));
  const otherRows = rows.filter(
    (row) => !isDefaultProspectTableViewName(row.name)
  );
  if (allRows.length === 0) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("prospect_table_views")
      .insert({
        owner_id: ownerId,
        surface: SURFACE,
        name: DEFAULT_POOL_TABLE_VIEW_NAME,
        settings: createDefaultPoolTableViewSettings(),
      })
      .select("id, owner_id, surface, name, settings, created_at, updated_at")
      .single();
    if (createError || !created) {
      throw new Error(createError?.message ?? "Unable to create default view.");
    }
    return [...otherRows, created as ViewRow];
  }
  return [...otherRows, allRows[0]];
}

export async function listPoolTableViewsForOwner(input: {
  ownerId: string;
}): Promise<PoolTableViewsPayload> {
  const rows = await ensureOwnerAllView(
    await loadOwnerViewRows(input.ownerId),
    input.ownerId
  );
  const views = orderPoolTableViews(rows.map(mapViewRow));
  const prefs = await loadPreferences(input.ownerId);
  const allViewId =
    views.find((view) => isDefaultProspectTableViewName(view.name))?.id ??
    views[0]?.id ??
    "";
  const visibleIds = new Set(views.map((view) => view.id));
  const viewOrder = normalizeViewOrder(
    prefs?.view_order,
    visibleIds,
    allViewId
  );
  const activeViewId = views.some((view) => view.id === prefs?.active_view_id)
    ? (prefs?.active_view_id as string)
    : allViewId;
  return {
    currentUserId: input.ownerId,
    views: orderPoolTableViews(views, viewOrder),
    activeViewId,
    autosave: prefs?.autosave ?? true,
    viewOrder,
  };
}

export async function createPoolTableViewForOwner(input: {
  ownerId: string;
  name: string;
  settings: unknown;
  makeActive?: boolean;
}): Promise<PoolTableViewsPayload> {
  const name = assertViewName(input.name, { allowAll: false });
  const settings = assertSettings(input.settings);
  const { data, error } = await supabaseAdmin
    .from("prospect_table_views")
    .insert({
      owner_id: input.ownerId,
      surface: SURFACE,
      name,
      settings,
    })
    .select("id, owner_id, surface, name, settings, created_at, updated_at")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create view.");
  }
  const payload = await listPoolTableViewsForOwner(input);
  if (input.makeActive) {
    return updatePoolTableViewPreferencesForOwner({
      ownerId: input.ownerId,
      activeViewId: (data as ViewRow).id,
    });
  }
  return payload;
}

export async function updatePoolTableViewForOwner(input: {
  ownerId: string;
  viewId: string;
  name?: string;
  settings?: unknown;
}): Promise<PoolTableViewsPayload> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("prospect_table_views")
    .select("id, name")
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", SURFACE)
    .maybeSingle();
  if (lookupError || !existing) throw new Error("View not found.");
  const isAllView = isDefaultProspectTableViewName(
    (existing as { name: string }).name
  );
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (isAllView) {
    if (
      typeof input.name === "string" &&
      !isDefaultProspectTableViewName(input.name)
    ) {
      throw new Error("The All view cannot be renamed.");
    }
    patch.name = DEFAULT_POOL_TABLE_VIEW_NAME;
    if (input.settings) patch.settings = assertSettings(input.settings);
  } else {
    if (typeof input.name === "string") {
      patch.name = assertViewName(input.name, { allowAll: false });
    }
    if (input.settings) patch.settings = assertSettings(input.settings);
  }
  const { error } = await supabaseAdmin
    .from("prospect_table_views")
    .update(patch)
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", SURFACE);
  if (error) throw new Error(error.message);
  return listPoolTableViewsForOwner(input);
}

export async function deletePoolTableViewForOwner(input: {
  ownerId: string;
  viewId: string;
}): Promise<PoolTableViewsPayload> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("prospect_table_views")
    .select("id, name")
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", SURFACE)
    .maybeSingle();
  if (lookupError || !existing) throw new Error("View not found.");
  if (isDefaultProspectTableViewName((existing as { name: string }).name)) {
    throw new Error("The All view cannot be deleted.");
  }
  const payload = await listPoolTableViewsForOwner(input);
  if (payload.views.length <= 1) {
    throw new Error("At least one view must remain.");
  }
  const { error } = await supabaseAdmin
    .from("prospect_table_views")
    .delete()
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", SURFACE);
  if (error) throw new Error(error.message);
  const nextOrder = payload.viewOrder.filter((id) => id !== input.viewId);
  return updatePoolTableViewPreferencesForOwner({
    ownerId: input.ownerId,
    viewOrder: nextOrder,
    activeViewId:
      payload.activeViewId === input.viewId
        ? payload.views.find((view) =>
            isDefaultProspectTableViewName(view.name)
          )?.id ?? payload.views.find((view) => view.id !== input.viewId)?.id
        : undefined,
  });
}

export async function updatePoolTableViewPreferencesForOwner(input: {
  ownerId: string;
  activeViewId?: string;
  autosave?: boolean;
  viewOrder?: string[];
}): Promise<PoolTableViewsPayload> {
  if (input.activeViewId) {
    const { data: view, error } = await supabaseAdmin
      .from("prospect_table_views")
      .select("id")
      .eq("id", input.activeViewId)
      .eq("owner_id", input.ownerId)
      .eq("surface", SURFACE)
      .maybeSingle();
    if (error || !view) throw new Error("View not found.");
  }
  const current = await listPoolTableViewsForOwner({ ownerId: input.ownerId });
  const prefs = await loadPreferences(input.ownerId);
  const allViewId =
    current.views.find((view) => isDefaultProspectTableViewName(view.name))
      ?.id ?? null;
  const visibleIds = new Set(current.views.map((view) => view.id));
  const nextViewOrder = input.viewOrder
    ? normalizeViewOrder(input.viewOrder, visibleIds, allViewId)
    : current.viewOrder;
  await upsertPreferences({
    userId: input.ownerId,
    activeViewId: input.activeViewId ?? prefs?.active_view_id ?? null,
    autosave:
      typeof input.autosave === "boolean"
        ? input.autosave
        : (prefs?.autosave ?? true),
    viewOrder: nextViewOrder,
  });
  return listPoolTableViewsForOwner({ ownerId: input.ownerId });
}
