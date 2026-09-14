import {
  createDefaultProspectTableViewSettings,
  createProspectTableView,
  DEFAULT_PROSPECT_TABLE_VIEW_NAME,
  isDefaultProspectTableViewName,
  MAX_PROSPECT_TABLE_VIEW_NAME_LENGTH,
  MAX_PROSPECT_TABLE_VIEW_SETTINGS_BYTES,
  normalizeProspectTableViewSettings,
  orderProspectTableViews,
  type ProspectTableView,
  type ProspectTableViewSettings,
  type ProspectTableViewSurface,
  type ProspectTableViewsPayload,
} from "@/lib/prospects/prospectTableViews";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProspectTableViewRow = {
  id: string;
  owner_id: string;
  surface: ProspectTableViewSurface;
  name: string;
  settings: unknown;
  created_at: string;
  updated_at: string;
};

type ProspectTableViewPreferencesRow = {
  user_id: string;
  surface: ProspectTableViewSurface;
  active_view_id: string | null;
  autosave: boolean;
  view_order: string[] | null;
  updated_at: string;
};

function mapViewRow(row: ProspectTableViewRow): ProspectTableView {
  const isAll = isDefaultProspectTableViewName(row.name);
  return createProspectTableView(
    isAll ? DEFAULT_PROSPECT_TABLE_VIEW_NAME : row.name,
    normalizeProspectTableViewSettings(row.settings),
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
  if (!trimmed) {
    throw new Error("View name is required.");
  }
  if (trimmed.length > MAX_PROSPECT_TABLE_VIEW_NAME_LENGTH) {
    throw new Error("View name is too long.");
  }
  if (!allowAll && isDefaultProspectTableViewName(trimmed)) {
    throw new Error('Reserved view name "All". Choose another name.');
  }
  return trimmed;
}

function assertSettings(settings: unknown): ProspectTableViewSettings {
  if (!settings || typeof settings !== "object") {
    throw new Error("Invalid view settings.");
  }
  const encoded = JSON.stringify(settings);
  if (encoded.length > MAX_PROSPECT_TABLE_VIEW_SETTINGS_BYTES) {
    throw new Error("View settings are too large.");
  }
  return normalizeProspectTableViewSettings(settings);
}

async function loadPreferences(
  userId: string,
  surface: ProspectTableViewSurface
): Promise<ProspectTableViewPreferencesRow | null> {
  const { data, error } = await supabaseAdmin
    .from("prospect_table_view_preferences")
    .select("user_id, surface, active_view_id, autosave, view_order, updated_at")
    .eq("user_id", userId)
    .eq("surface", surface)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as ProspectTableViewPreferencesRow | null) ?? null;
}

async function upsertPreferences(input: {
  userId: string;
  surface: ProspectTableViewSurface;
  activeViewId: string | null;
  autosave: boolean;
  viewOrder: string[];
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("prospect_table_view_preferences")
    .upsert(
      {
        user_id: input.userId,
        surface: input.surface,
        active_view_id: input.activeViewId,
        autosave: input.autosave,
        view_order: input.viewOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,surface" }
    );
  if (error) {
    throw new Error(error.message);
  }
}

async function ensureOwnerAllView(
  rows: ProspectTableViewRow[],
  ownerId: string,
  surface: ProspectTableViewSurface
): Promise<ProspectTableViewRow[]> {
  const allRows = rows.filter((row) => isDefaultProspectTableViewName(row.name));
  const otherRows = rows.filter(
    (row) => !isDefaultProspectTableViewName(row.name)
  );

  if (allRows.length === 0) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("prospect_table_views")
      .insert({
        owner_id: ownerId,
        surface,
        name: DEFAULT_PROSPECT_TABLE_VIEW_NAME,
        settings: createDefaultProspectTableViewSettings(),
      })
      .select(
        "id, owner_id, surface, name, settings, created_at, updated_at"
      )
      .single();

    if (createError || !created) {
      throw new Error(createError?.message ?? "Unable to create default view.");
    }
    return [...otherRows, created as ProspectTableViewRow];
  }

  const preferred =
    allRows.find(
      (row) =>
        row.name.trim().toLowerCase() ===
        DEFAULT_PROSPECT_TABLE_VIEW_NAME.toLowerCase()
    ) ??
    [...allRows].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  if (preferred.name.trim() !== DEFAULT_PROSPECT_TABLE_VIEW_NAME) {
    const { error: resetError } = await supabaseAdmin
      .from("prospect_table_views")
      .update({
        name: DEFAULT_PROSPECT_TABLE_VIEW_NAME,
        updated_at: new Date().toISOString(),
      })
      .eq("id", preferred.id);
    if (resetError) {
      throw new Error(resetError.message);
    }
    preferred.name = DEFAULT_PROSPECT_TABLE_VIEW_NAME;
  }

  const duplicates = allRows.filter((row) => row.id !== preferred.id);
  if (duplicates.length > 0) {
    const duplicateIds = duplicates.map((row) => row.id);
    await supabaseAdmin
      .from("prospect_table_view_preferences")
      .update({
        active_view_id: preferred.id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", ownerId)
      .eq("surface", surface)
      .in("active_view_id", duplicateIds);

    const { error: deleteError } = await supabaseAdmin
      .from("prospect_table_views")
      .delete()
      .in("id", duplicateIds)
      .eq("owner_id", ownerId)
      .eq("surface", surface);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  return [...otherRows, preferred];
}

async function loadOwnerViewRows(
  ownerId: string,
  surface: ProspectTableViewSurface
): Promise<ProspectTableViewRow[]> {
  const { data, error } = await supabaseAdmin
    .from("prospect_table_views")
    .select("id, owner_id, surface, name, settings, created_at, updated_at")
    .eq("owner_id", ownerId)
    .eq("surface", surface)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as ProspectTableViewRow[];
}

export async function listProspectTableViewsForOwner(input: {
  ownerId: string;
  surface: ProspectTableViewSurface;
}): Promise<ProspectTableViewsPayload> {
  const ensured = await ensureOwnerAllView(
    await loadOwnerViewRows(input.ownerId, input.surface),
    input.ownerId,
    input.surface
  );
  const mapped = ensured.map(mapViewRow);
  const prefs = await loadPreferences(input.ownerId, input.surface);
  const allViewId =
    mapped.find((view) => isDefaultProspectTableViewName(view.name))?.id ??
    null;
  const visibleIds = new Set(mapped.map((view) => view.id));
  const viewOrder = normalizeViewOrder(
    prefs?.view_order,
    visibleIds,
    allViewId
  );
  const views = orderProspectTableViews(mapped, viewOrder);

  let activeViewId = prefs?.active_view_id ?? allViewId ?? views[0]?.id;
  if (!activeViewId || !visibleIds.has(activeViewId)) {
    activeViewId = allViewId ?? views[0].id;
  }

  const prefsNeedWrite =
    !prefs ||
    prefs.active_view_id !== activeViewId ||
    JSON.stringify(prefs.view_order ?? []) !== JSON.stringify(viewOrder);

  if (prefsNeedWrite) {
    await upsertPreferences({
      userId: input.ownerId,
      surface: input.surface,
      activeViewId,
      autosave: prefs?.autosave ?? false,
      viewOrder,
    });
  }

  return {
    currentUserId: input.ownerId,
    views,
    activeViewId,
    autosave: prefs?.autosave ?? false,
    viewOrder,
  };
}

export async function createProspectTableViewForOwner(input: {
  ownerId: string;
  surface: ProspectTableViewSurface;
  name: string;
  settings: unknown;
  makeActive?: boolean;
}): Promise<ProspectTableViewsPayload> {
  const name = assertViewName(input.name, { allowAll: false });
  const settings = assertSettings(input.settings);

  const { data, error } = await supabaseAdmin
    .from("prospect_table_views")
    .insert({
      owner_id: input.ownerId,
      surface: input.surface,
      name,
      settings,
      updated_at: new Date().toISOString(),
    })
    .select("id, owner_id, surface, name, settings, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create view.");
  }

  const createdId = (data as ProspectTableViewRow).id;
  const current = await listProspectTableViewsForOwner(input);
  const nextOrder = [
    ...current.viewOrder.filter((id) => id !== createdId),
    createdId,
  ];

  await updateProspectTableViewPreferencesForOwner({
    ownerId: input.ownerId,
    surface: input.surface,
    viewOrder: nextOrder,
    activeViewId: input.makeActive ? createdId : undefined,
  });

  return listProspectTableViewsForOwner(input);
}

export async function updateProspectTableViewForOwner(input: {
  ownerId: string;
  surface: ProspectTableViewSurface;
  viewId: string;
  name?: string;
  settings?: unknown;
}): Promise<ProspectTableViewsPayload> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("prospect_table_views")
    .select("id, owner_id, surface, name")
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", input.surface)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error("View not found.");
  }
  const existingRow = existing as { name: string };
  const isAllView = isDefaultProspectTableViewName(existingRow.name);

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
    patch.name = DEFAULT_PROSPECT_TABLE_VIEW_NAME;
    if (input.settings) {
      patch.settings = assertSettings(input.settings);
    }
  } else {
    if (typeof input.name === "string") {
      patch.name = assertViewName(input.name, { allowAll: false });
    }
    if (input.settings) {
      patch.settings = assertSettings(input.settings);
    }
  }

  const { error } = await supabaseAdmin
    .from("prospect_table_views")
    .update(patch)
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", input.surface);

  if (error) {
    throw new Error(error.message);
  }

  return listProspectTableViewsForOwner(input);
}

export async function deleteProspectTableViewForOwner(input: {
  ownerId: string;
  surface: ProspectTableViewSurface;
  viewId: string;
}): Promise<ProspectTableViewsPayload> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("prospect_table_views")
    .select("id, owner_id, name")
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", input.surface)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error("View not found.");
  }
  const existingRow = existing as { name: string };
  if (isDefaultProspectTableViewName(existingRow.name)) {
    throw new Error("The All view cannot be deleted.");
  }

  const payload = await listProspectTableViewsForOwner(input);
  if (payload.views.length <= 1) {
    throw new Error("At least one view must remain.");
  }

  const { error } = await supabaseAdmin
    .from("prospect_table_views")
    .delete()
    .eq("id", input.viewId)
    .eq("owner_id", input.ownerId)
    .eq("surface", input.surface);

  if (error) {
    throw new Error(error.message);
  }

  const nextOrder = payload.viewOrder.filter((id) => id !== input.viewId);
  await updateProspectTableViewPreferencesForOwner({
    ownerId: input.ownerId,
    surface: input.surface,
    viewOrder: nextOrder,
    activeViewId:
      payload.activeViewId === input.viewId
        ? payload.views.find((view) =>
            isDefaultProspectTableViewName(view.name)
          )?.id ?? payload.views.find((view) => view.id !== input.viewId)?.id
        : undefined,
  });

  return listProspectTableViewsForOwner(input);
}

export async function updateProspectTableViewPreferencesForOwner(input: {
  ownerId: string;
  surface: ProspectTableViewSurface;
  activeViewId?: string;
  autosave?: boolean;
  viewOrder?: string[];
}): Promise<ProspectTableViewsPayload> {
  if (input.activeViewId) {
    const { data: view, error } = await supabaseAdmin
      .from("prospect_table_views")
      .select("id")
      .eq("id", input.activeViewId)
      .eq("owner_id", input.ownerId)
      .eq("surface", input.surface)
      .maybeSingle();

    if (error || !view) {
      throw new Error("View not found.");
    }
  }

  const current = await listProspectTableViewsForOwner({
    ownerId: input.ownerId,
    surface: input.surface,
  });
  const prefs = await loadPreferences(input.ownerId, input.surface);
  const allViewId =
    current.views.find((view) => isDefaultProspectTableViewName(view.name))
      ?.id ?? null;
  const visibleIds = new Set(current.views.map((view) => view.id));
  const nextViewOrder = input.viewOrder
    ? normalizeViewOrder(input.viewOrder, visibleIds, allViewId)
    : current.viewOrder;

  await upsertPreferences({
    userId: input.ownerId,
    surface: input.surface,
    activeViewId: input.activeViewId ?? prefs?.active_view_id ?? null,
    autosave:
      typeof input.autosave === "boolean"
        ? input.autosave
        : (prefs?.autosave ?? false),
    viewOrder: nextViewOrder,
  });

  return listProspectTableViewsForOwner({
    ownerId: input.ownerId,
    surface: input.surface,
  });
}
