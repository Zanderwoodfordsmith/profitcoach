import {
  createCoachTableView,
  createDefaultCoachTableViewSettings,
  DEFAULT_COACH_TABLE_VIEW_NAME,
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
  updated_at: string;
};

function mapViewRow(row: CoachTableViewRow, currentUserId: string): CoachTableView {
  return createCoachTableView(
    row.name,
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
    isPrivate: row.is_private,
    canEdit: row.created_by === currentUserId,
  });
}

function viewVisibleToUser(row: CoachTableViewRow, userId: string): boolean {
  return !row.is_private || row.created_by === userId;
}

export async function listCoachTableViewsForAdmin(
  userId: string
): Promise<CoachTableViewsPayload> {
  const { data: viewRows, error: viewsError } = await supabaseAdmin
    .from("admin_coach_table_views")
    .select("id, name, created_by, is_private, settings, created_at, updated_at")
    .or(`is_private.eq.false,created_by.eq.${userId}`)
    .order("created_at", { ascending: true });

  if (viewsError) {
    throw new Error(viewsError.message);
  }

  let rows = (viewRows ?? []) as CoachTableViewRow[];

  if (rows.length === 0) {
    const defaultSettings = createDefaultCoachTableViewSettings();
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
    rows = [created as CoachTableViewRow];
  }

  const views = rows.map((row) => mapViewRow(row, userId));

  const { data: prefRow, error: prefError } = await supabaseAdmin
    .from("admin_coach_table_view_preferences")
    .select("user_id, active_view_id, autosave, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefError) {
    throw new Error(prefError.message);
  }

  const prefs = (prefRow as CoachTableViewPreferencesRow | null) ?? null;
  const visibleIds = new Set(views.map((view) => view.id));
  let activeViewId = prefs?.active_view_id ?? views[0].id;
  if (!visibleIds.has(activeViewId)) {
    activeViewId = views[0].id;
  }

  if (
    !prefs ||
    prefs.active_view_id !== activeViewId ||
    prefs.autosave == null
  ) {
    await supabaseAdmin.from("admin_coach_table_view_preferences").upsert(
      {
        user_id: userId,
        active_view_id: activeViewId,
        autosave: prefs?.autosave ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }

  return {
    currentUserId: userId,
    views,
    activeViewId,
    autosave: prefs?.autosave ?? false,
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

  if (input.makeActive) {
    await updateCoachTableViewPreferencesForAdmin(input.userId, {
      activeViewId: (data as CoachTableViewRow).id,
    });
  }

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
    .select("id, created_by")
    .eq("id", input.viewId)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error("View not found.");
  }
  if ((existing as { created_by: string }).created_by !== input.userId) {
    throw new Error("Not authorized to edit this view.");
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.name === "string") {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("View name is required.");
    patch.name = trimmed;
  }
  if (input.settings) {
    patch.settings = normalizeCoachTableViewSettings(input.settings);
  }
  if (typeof input.isPrivate === "boolean") {
    patch.is_private = input.isPrivate;
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
    .select("id, created_by")
    .eq("id", viewId)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error("View not found.");
  }
  if ((existing as { created_by: string }).created_by !== userId) {
    throw new Error("Not authorized to delete this view.");
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

  const next = await listCoachTableViewsForAdmin(userId);
  if (next.activeViewId === viewId) {
    await updateCoachTableViewPreferencesForAdmin(userId, {
      activeViewId: next.views[0]?.id,
    });
    return listCoachTableViewsForAdmin(userId);
  }
  return next;
}

export async function updateCoachTableViewPreferencesForAdmin(
  userId: string,
  input: {
    activeViewId?: string;
    autosave?: boolean;
  }
): Promise<CoachTableViewsPayload> {
  if (input.activeViewId) {
    const { data: view, error } = await supabaseAdmin
      .from("admin_coach_table_views")
      .select("id, created_by, is_private")
      .eq("id", input.activeViewId)
      .maybeSingle();

    if (error || !view) {
      throw new Error("View not found.");
    }
    const row = view as Pick<CoachTableViewRow, "id" | "created_by" | "is_private">;
    if (!viewVisibleToUser(row as CoachTableViewRow, userId)) {
      throw new Error("View not found.");
    }
  }

  const patch: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (input.activeViewId) patch.active_view_id = input.activeViewId;
  if (typeof input.autosave === "boolean") patch.autosave = input.autosave;

  const { error } = await supabaseAdmin
    .from("admin_coach_table_view_preferences")
    .upsert(patch, { onConflict: "user_id" });

  if (error) {
    throw new Error(error.message);
  }

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
