import {
  createCoachTableView,
  createDefaultCoachTableViewSettings,
  DEFAULT_COACH_TABLE_VIEW_NAME,
  isDefaultCoachTableViewName,
  orderCoachTableViews,
  type CoachTableView,
  type CoachTableViewSettings,
  type CoachTableViewsPayload,
} from "@/lib/admin/coachTableViews";
import { normalizeCoachTableViewSettings } from "@/lib/admin/coachTableSort";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CoachTableViewRow = {
  id: string;
  name: string;
  created_by: string;
  is_private: boolean;
  settings: unknown;
  created_at: string;
  updated_at: string;
};

export type CoachTableViewPreferencesRow = {
  user_id: string;
  active_view_id: string | null;
  autosave: boolean;
  view_order: string[] | null;
  updated_at: string;
};

function mapViewRow(row: CoachTableViewRow, currentUserId: string): CoachTableView {
  const isAll = isDefaultCoachTableViewName(row.name);
  return createCoachTableView(
    isAll ? DEFAULT_COACH_TABLE_VIEW_NAME : row.name,
    normalizeCoachTableViewSettings(
      row.settings as CoachTableViewSettings & {
        sortField?: unknown;
        sortOrder?: unknown;
        lastLoginSort?: unknown;
      }
    ),
    {
      id: row.id,
      createdBy: row.created_by,
      // All is always shared with every admin.
      isPrivate: isAll ? false : row.is_private,
      canEdit: isAll ? false : row.created_by === currentUserId,
    }
  );
}

function viewVisibleToUser(row: CoachTableViewRow, userId: string): boolean {
  if (isDefaultCoachTableViewName(row.name)) return true;
  return !row.is_private || row.created_by === userId;
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

function isMissingViewOrderColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("view_order") && lower.includes("column");
}

async function loadCoachTableViewPreferences(
  userId: string
): Promise<{
  prefs: CoachTableViewPreferencesRow | null;
  supportsViewOrder: boolean;
}> {
  const withOrder = await supabaseAdmin
    .from("admin_coach_table_view_preferences")
    .select("user_id, active_view_id, autosave, view_order, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!withOrder.error) {
    return {
      prefs: (withOrder.data as CoachTableViewPreferencesRow | null) ?? null,
      supportsViewOrder: true,
    };
  }

  if (!isMissingViewOrderColumnError(withOrder.error.message)) {
    throw new Error(withOrder.error.message);
  }

  // Migration not applied yet — keep views usable without reorder persistence.
  const withoutOrder = await supabaseAdmin
    .from("admin_coach_table_view_preferences")
    .select("user_id, active_view_id, autosave, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (withoutOrder.error) {
    throw new Error(withoutOrder.error.message);
  }

  const row = withoutOrder.data as Omit<
    CoachTableViewPreferencesRow,
    "view_order"
  > | null;

  return {
    prefs: row
      ? {
          ...row,
          view_order: [],
        }
      : null,
    supportsViewOrder: false,
  };
}

async function upsertCoachTableViewPreferences(input: {
  userId: string;
  activeViewId: string | null;
  autosave: boolean;
  viewOrder?: string[];
  supportsViewOrder: boolean;
}): Promise<void> {
  const base = {
    user_id: input.userId,
    active_view_id: input.activeViewId,
    autosave: input.autosave,
    updated_at: new Date().toISOString(),
  };

  if (input.supportsViewOrder) {
    const { error } = await supabaseAdmin
      .from("admin_coach_table_view_preferences")
      .upsert(
        {
          ...base,
          view_order: input.viewOrder ?? [],
        },
        { onConflict: "user_id" }
      );
    if (!error) return;
    if (!isMissingViewOrderColumnError(error.message)) {
      throw new Error(error.message);
    }
  }

  const { error } = await supabaseAdmin
    .from("admin_coach_table_view_preferences")
    .upsert(base, { onConflict: "user_id" });
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Ensure exactly one shared All view exists for every admin.
 * Deduplicates legacy/private All rows.
 */
async function ensureSharedAllView(
  rows: CoachTableViewRow[],
  userId: string
): Promise<CoachTableViewRow[]> {
  const defaultSettings = createDefaultCoachTableViewSettings();
  const allRows = rows.filter((row) => isDefaultCoachTableViewName(row.name));
  const otherRows = rows.filter((row) => !isDefaultCoachTableViewName(row.name));

  if (allRows.length === 0) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("admin_coach_table_views")
      .insert({
        name: DEFAULT_COACH_TABLE_VIEW_NAME,
        created_by: userId,
        is_private: false,
        settings: defaultSettings,
      })
      .select("id, name, created_by, is_private, settings, created_at, updated_at")
      .single();

    if (createError || !created) {
      throw new Error(createError?.message ?? "Unable to create default view.");
    }
    return [...otherRows, created as CoachTableViewRow];
  }

  // Prefer a shared canonical "All", else oldest.
  const preferred =
    allRows.find(
      (row) =>
        !row.is_private &&
        row.name.trim().toLowerCase() ===
          DEFAULT_COACH_TABLE_VIEW_NAME.toLowerCase()
    ) ??
    allRows.find((row) => !row.is_private) ??
    [...allRows].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  const needsReset =
    preferred.name.trim() !== DEFAULT_COACH_TABLE_VIEW_NAME ||
    preferred.is_private ||
    JSON.stringify(
      normalizeCoachTableViewSettings(
        preferred.settings as CoachTableViewSettings & {
          sortField?: unknown;
          sortOrder?: unknown;
          lastLoginSort?: unknown;
        }
      )
    ) !== JSON.stringify(defaultSettings);

  if (needsReset) {
    const { error: resetError } = await supabaseAdmin
      .from("admin_coach_table_views")
      .update({
        name: DEFAULT_COACH_TABLE_VIEW_NAME,
        is_private: false,
        settings: defaultSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", preferred.id);
    if (resetError) {
      throw new Error(resetError.message);
    }
  }
  preferred.name = DEFAULT_COACH_TABLE_VIEW_NAME;
  preferred.is_private = false;
  preferred.settings = defaultSettings;

  const duplicates = allRows.filter((row) => row.id !== preferred.id);
  if (duplicates.length > 0) {
    const duplicateIds = duplicates.map((row) => row.id);
    // Point any preferences at the canonical All before deleting duplicates.
    await supabaseAdmin
      .from("admin_coach_table_view_preferences")
      .update({
        active_view_id: preferred.id,
        updated_at: new Date().toISOString(),
      })
      .in("active_view_id", duplicateIds);

    const { error: deleteError } = await supabaseAdmin
      .from("admin_coach_table_views")
      .delete()
      .in("id", duplicateIds);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  return [...otherRows, preferred];
}

export async function listCoachTableViewsForAdmin(
  userId: string
): Promise<CoachTableViewsPayload> {
  // Use service role so we can find/create the shared All even if it was private.
  const { data: viewRows, error: viewsError } = await supabaseAdmin
    .from("admin_coach_table_views")
    .select("id, name, created_by, is_private, settings, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (viewsError) {
    throw new Error(viewsError.message);
  }

  const ensured = await ensureSharedAllView(
    (viewRows ?? []) as CoachTableViewRow[],
    userId
  );

  const visibleRows = ensured.filter((row) => viewVisibleToUser(row, userId));
  const mapped = visibleRows.map((row) => mapViewRow(row, userId));

  const { prefs, supportsViewOrder } =
    await loadCoachTableViewPreferences(userId);
  const allViewId =
    mapped.find((view) => isDefaultCoachTableViewName(view.name))?.id ?? null;
  const visibleIds = new Set(mapped.map((view) => view.id));
  const viewOrder = normalizeViewOrder(
    prefs?.view_order,
    visibleIds,
    allViewId
  );
  const views = orderCoachTableViews(mapped, viewOrder);

  let activeViewId = prefs?.active_view_id ?? allViewId ?? views[0]?.id;
  if (!activeViewId || !visibleIds.has(activeViewId)) {
    activeViewId = allViewId ?? views[0].id;
  }

  const prefsNeedWrite =
    !prefs ||
    prefs.active_view_id !== activeViewId ||
    prefs.autosave == null ||
    (supportsViewOrder &&
      JSON.stringify(prefs.view_order ?? []) !== JSON.stringify(viewOrder));

  if (prefsNeedWrite) {
    await upsertCoachTableViewPreferences({
      userId,
      activeViewId,
      autosave: prefs?.autosave ?? false,
      viewOrder,
      supportsViewOrder,
    });
  }

  return {
    currentUserId: userId,
    views,
    activeViewId,
    autosave: prefs?.autosave ?? false,
    viewOrder,
  };
}

export async function createCoachTableViewForAdmin(input: {
  userId: string;
  name: string;
  settings: CoachTableViewSettings;
  isPrivate?: boolean;
  makeActive?: boolean;
}): Promise<CoachTableViewsPayload> {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error("View name is required.");
  }
  if (isDefaultCoachTableViewName(trimmed)) {
    throw new Error('Reserved view name "All". Choose another name.');
  }

  const settings = normalizeCoachTableViewSettings(input.settings);
  const { data, error } = await supabaseAdmin
    .from("admin_coach_table_views")
    .insert({
      name: trimmed,
      created_by: input.userId,
      is_private: input.isPrivate === true,
      settings,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, created_by, is_private, settings, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create view.");
  }

  const createdId = (data as CoachTableViewRow).id;
  const current = await listCoachTableViewsForAdmin(input.userId);
  const nextOrder = [
    ...current.viewOrder.filter((id) => id !== createdId),
    createdId,
  ];

  await updateCoachTableViewPreferencesForAdmin(input.userId, {
    viewOrder: nextOrder,
    activeViewId: input.makeActive ? createdId : undefined,
  });

  return listCoachTableViewsForAdmin(input.userId);
}

export async function updateCoachTableViewForAdmin(input: {
  userId: string;
  viewId: string;
  name?: string;
  settings?: CoachTableViewSettings;
  isPrivate?: boolean;
}): Promise<CoachTableViewsPayload> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("admin_coach_table_views")
    .select("id, created_by, name")
    .eq("id", input.viewId)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error("View not found.");
  }
  const existingRow = existing as { created_by: string; name: string };
  if (existingRow.created_by !== input.userId) {
    throw new Error("Not authorized to edit this view.");
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const isAllView = isDefaultCoachTableViewName(existingRow.name);
  if (isAllView) {
    if (typeof input.name === "string" && !isDefaultCoachTableViewName(input.name)) {
      throw new Error("The All view cannot be renamed.");
    }
    if (input.isPrivate === true) {
      throw new Error("The All view must stay shared with every admin.");
    }
    // All stays shared and at default unfiltered settings.
    patch.name = DEFAULT_COACH_TABLE_VIEW_NAME;
    patch.is_private = false;
    if (input.settings) {
      patch.settings = createDefaultCoachTableViewSettings();
    }
  } else {
    if (typeof input.name === "string") {
      const trimmed = input.name.trim();
      if (!trimmed) throw new Error("View name is required.");
      if (isDefaultCoachTableViewName(trimmed)) {
        throw new Error('Reserved view name "All". Choose another name.');
      }
      patch.name = trimmed;
    }
    if (input.settings) {
      patch.settings = normalizeCoachTableViewSettings(input.settings);
    }
    if (typeof input.isPrivate === "boolean") {
      patch.is_private = input.isPrivate;
    }
  }

  const { error } = await supabaseAdmin
    .from("admin_coach_table_views")
    .update(patch)
    .eq("id", input.viewId);

  if (error) {
    throw new Error(error.message);
  }

  return listCoachTableViewsForAdmin(input.userId);
}

export async function deleteCoachTableViewForAdmin(
  userId: string,
  viewId: string
): Promise<CoachTableViewsPayload> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("admin_coach_table_views")
    .select("id, created_by, name")
    .eq("id", viewId)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error("View not found.");
  }
  const existingRow = existing as { created_by: string; name: string };
  if (existingRow.created_by !== userId) {
    throw new Error("Not authorized to delete this view.");
  }
  if (isDefaultCoachTableViewName(existingRow.name)) {
    throw new Error("The All view cannot be deleted.");
  }

  const payload = await listCoachTableViewsForAdmin(userId);
  if (payload.views.length <= 1) {
    throw new Error("At least one view must remain.");
  }

  const { error } = await supabaseAdmin
    .from("admin_coach_table_views")
    .delete()
    .eq("id", viewId);

  if (error) {
    throw new Error(error.message);
  }

  const nextOrder = payload.viewOrder.filter((id) => id !== viewId);
  await updateCoachTableViewPreferencesForAdmin(userId, {
    viewOrder: nextOrder,
    activeViewId:
      payload.activeViewId === viewId
        ? payload.views.find((view) => isDefaultCoachTableViewName(view.name))
            ?.id ?? payload.views.find((view) => view.id !== viewId)?.id
        : undefined,
  });

  return listCoachTableViewsForAdmin(userId);
}

export async function updateCoachTableViewPreferencesForAdmin(
  userId: string,
  input: {
    activeViewId?: string;
    autosave?: boolean;
    viewOrder?: string[];
  }
): Promise<CoachTableViewsPayload> {
  if (input.activeViewId) {
    const { data: view, error } = await supabaseAdmin
      .from("admin_coach_table_views")
      .select("id, created_by, is_private, name")
      .eq("id", input.activeViewId)
      .maybeSingle();

    if (error || !view) {
      throw new Error("View not found.");
    }
    const row = view as Pick<
      CoachTableViewRow,
      "id" | "created_by" | "is_private" | "name"
    >;
    if (!viewVisibleToUser(row as CoachTableViewRow, userId)) {
      throw new Error("View not found.");
    }
  }

  const { prefs, supportsViewOrder } =
    await loadCoachTableViewPreferences(userId);

  let nextViewOrder = prefs?.view_order ?? [];
  if (input.viewOrder) {
    const { data: viewRows, error: viewsError } = await supabaseAdmin
      .from("admin_coach_table_views")
      .select(
        "id, name, created_by, is_private, settings, created_at, updated_at"
      );
    if (viewsError) {
      throw new Error(viewsError.message);
    }
    const visibleRows = ((viewRows ?? []) as CoachTableViewRow[]).filter((row) =>
      viewVisibleToUser(row, userId)
    );
    const allViewId =
      visibleRows.find((row) => isDefaultCoachTableViewName(row.name))?.id ??
      null;
    const visibleIds = new Set(visibleRows.map((row) => row.id));
    nextViewOrder = normalizeViewOrder(input.viewOrder, visibleIds, allViewId);
  }

  await upsertCoachTableViewPreferences({
    userId,
    activeViewId: input.activeViewId ?? prefs?.active_view_id ?? null,
    autosave:
      typeof input.autosave === "boolean"
        ? input.autosave
        : (prefs?.autosave ?? false),
    viewOrder: nextViewOrder,
    supportsViewOrder,
  });

  return listCoachTableViewsForAdmin(userId);
}

export async function getCoachTableViewForAdmin(
  userId: string,
  viewId: string
): Promise<CoachTableView | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_coach_table_views")
    .select("id, name, created_by, is_private, settings, created_at, updated_at")
    .eq("id", viewId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as CoachTableViewRow;
  if (!viewVisibleToUser(row, userId)) return null;
  return mapViewRow(row, userId);
}
