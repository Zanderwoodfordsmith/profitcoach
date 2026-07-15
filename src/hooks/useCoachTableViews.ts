"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCoachTableViewRemote,
  deleteCoachTableViewRemote,
  fetchCoachTableViews,
  updateCoachTableViewPreferencesRemote,
  updateCoachTableViewRemote,
} from "@/lib/admin/coachTableViewsClient";
import {
  COACH_TABLE_VIEWS_MIGRATED_KEY,
  COACH_TABLE_VIEWS_STORAGE_KEY,
  DEFAULT_COACH_TABLE_VIEW_NAME,
  LEGACY_COACH_TABLE_SETTINGS_KEY,
  coachTableViewSettingsEqual,
  createCoachTableView,
  isDefaultCoachTableViewName,
  orderCoachTableViews,
  type CoachTableView,
  type CoachTableViewSettings,
  type CoachTableViewsPayload,
  type CoachTableViewsStorage,
} from "@/lib/admin/coachTableViews";
import { normalizeCoachTableViewSettings } from "@/lib/admin/coachTableSort";

function settingsForView(view: CoachTableView): CoachTableViewSettings {
  return view.settings;
}

function nonAllViewOrder(views: CoachTableView[]): string[] {
  return views
    .filter((view) => !isDefaultCoachTableViewName(view.name))
    .map((view) => view.id);
}

type UseCoachTableViewsOptions = {
  currentSettings: CoachTableViewSettings;
  onApplySettings: (settings: CoachTableViewSettings) => void;
  createDefaultSettings: () => CoachTableViewSettings;
  getAccessToken: () => Promise<string | null>;
  migrateLegacySettings?: (raw: string) => CoachTableViewSettings | null;
  ready: boolean;
};

function payloadToStorage(payload: CoachTableViewsPayload): CoachTableViewsStorage {
  const viewOrder = Array.isArray(payload.viewOrder)
    ? payload.viewOrder
    : nonAllViewOrder(payload.views);
  const views = orderCoachTableViews(payload.views, viewOrder);
  const allViewId = views.find((view) =>
    isDefaultCoachTableViewName(view.name)
  )?.id;
  const activeViewId = views.some((view) => view.id === payload.activeViewId)
    ? payload.activeViewId
    : allViewId ?? views[0]?.id ?? payload.activeViewId;
  return {
    version: 1,
    views,
    activeViewId,
    autosave: payload.autosave,
    viewOrder: nonAllViewOrder(views),
  };
}

function parseLocalViewsStorage(raw: string): CoachTableViewsStorage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CoachTableViewsStorage>;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.views) ||
      parsed.views.length === 0 ||
      typeof parsed.activeViewId !== "string"
    ) {
      return null;
    }
    const views = parsed.views
      .filter(
        (view): view is CoachTableView =>
          Boolean(
            view &&
              typeof view.id === "string" &&
              typeof view.name === "string" &&
              view.settings &&
              typeof view.settings === "object"
          )
      )
      .map((view) => ({
        ...view,
        createdBy: view.createdBy ?? "",
        isPrivate: view.isPrivate ?? true,
        canEdit: view.canEdit ?? true,
        settings: normalizeCoachTableViewSettings(
          view.settings as CoachTableViewSettings & {
            sortField?: unknown;
            sortOrder?: unknown;
            lastLoginSort?: unknown;
          }
        ),
      }));
    if (views.length === 0) return null;
    const activeViewId = views.some((v) => v.id === parsed.activeViewId)
      ? parsed.activeViewId
      : views[0].id;
    return {
      version: 1,
      views: orderCoachTableViews(views, parsed.viewOrder ?? []),
      activeViewId,
      autosave: parsed.autosave === true,
      viewOrder: Array.isArray(parsed.viewOrder)
        ? parsed.viewOrder.filter((id): id is string => typeof id === "string")
        : nonAllViewOrder(views),
    };
  } catch {
    return null;
  }
}

function loadLocalViewsStorage(
  createDefaultSettings: () => CoachTableViewSettings,
  migrateLegacySettings?: (raw: string) => CoachTableViewSettings | null
): CoachTableViewsStorage | null {
  if (typeof window === "undefined") return null;

  const rawV1 = window.localStorage.getItem(COACH_TABLE_VIEWS_STORAGE_KEY);
  if (rawV1) {
    const parsed = parseLocalViewsStorage(rawV1);
    if (parsed) return parsed;
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_COACH_TABLE_SETTINGS_KEY);
  if (legacyRaw && migrateLegacySettings) {
    const migrated = migrateLegacySettings(legacyRaw);
    if (migrated) {
      const view = createCoachTableView(DEFAULT_COACH_TABLE_VIEW_NAME, migrated, {
        isPrivate: true,
        canEdit: true,
      });
      return {
        version: 1,
        views: [view],
        activeViewId: view.id,
        autosave: false,
        viewOrder: [],
      };
    }
  }

  const fallback = createDefaultSettings();
  if (!rawV1 && !legacyRaw) return null;
  const view = createCoachTableView(DEFAULT_COACH_TABLE_VIEW_NAME, fallback, {
    isPrivate: true,
    canEdit: true,
  });
  return {
    version: 1,
    views: [view],
    activeViewId: view.id,
    autosave: false,
    viewOrder: [],
  };
}

export function useCoachTableViews({
  currentSettings,
  onApplySettings,
  createDefaultSettings,
  getAccessToken,
  migrateLegacySettings,
  ready,
}: UseCoachTableViewsOptions) {
  const [storage, setStorage] = useState<CoachTableViewsStorage | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applyingViewRef = useRef(false);
  const initialAppliedRef = useRef(false);
  const onApplySettingsRef = useRef(onApplySettings);
  onApplySettingsRef.current = onApplySettings;

  const applyPayload = useCallback((payload: CoachTableViewsPayload) => {
    setCurrentUserId(payload.currentUserId);
    setStorage(payloadToStorage(payload));
  }, []);

  const refreshViews = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error("Missing access token.");
    const payload = await fetchCoachTableViews(token);
    applyPayload(payload);
    return payload;
  }, [applyPayload, getAccessToken]);

  const migrateLocalViewsIfNeeded = useCallback(
    async (token: string) => {
      if (typeof window === "undefined") return;
      if (window.localStorage.getItem(COACH_TABLE_VIEWS_MIGRATED_KEY) === "1") {
        return;
      }

      const local = loadLocalViewsStorage(
        createDefaultSettings,
        migrateLegacySettings
      );
      if (!local) {
        window.localStorage.setItem(COACH_TABLE_VIEWS_MIGRATED_KEY, "1");
        return;
      }

      const customViews = local.views.filter(
        (view) => !isDefaultCoachTableViewName(view.name)
      );
      for (const view of customViews) {
        await createCoachTableViewRemote(token, {
          name: view.name,
          settings: view.settings,
          isPrivate: true,
        });
      }

      window.localStorage.removeItem(COACH_TABLE_VIEWS_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_COACH_TABLE_SETTINGS_KEY);
      window.localStorage.setItem(COACH_TABLE_VIEWS_MIGRATED_KEY, "1");
    },
    [createDefaultSettings, migrateLegacySettings]
  );

  useEffect(() => {
    if (!ready || hasLoaded) return;
    let cancelled = false;

    function seedLocalAllView() {
      const defaults = createDefaultSettings();
      const allView = createCoachTableView(
        DEFAULT_COACH_TABLE_VIEW_NAME,
        defaults,
        { isPrivate: false, canEdit: true }
      );
      setStorage({
        version: 1,
        views: [allView],
        activeViewId: allView.id,
        autosave: false,
        viewOrder: [],
      });
      onApplySettingsRef.current(defaults);
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Missing access token.");
        await migrateLocalViewsIfNeeded(token);
        const payload = await fetchCoachTableViews(token);
        if (cancelled) return;
        if (!payload.views?.length) {
          seedLocalAllView();
        } else {
          applyPayload(payload);
        }
        setHasLoaded(true);
      } catch (err) {
        if (cancelled) return;
        // Keep an All tab visible even when the API/migration is unavailable.
        seedLocalAllView();
        setError(err instanceof Error ? err.message : "Unable to load views.");
        setHasLoaded(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    applyPayload,
    createDefaultSettings,
    getAccessToken,
    hasLoaded,
    migrateLocalViewsIfNeeded,
    ready,
  ]);

  const runMutation = useCallback(
    async (mutate: (token: string) => Promise<CoachTableViewsPayload>) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing access token.");
      const payload = await mutate(token);
      applyPayload(payload);
      return payload;
    },
    [applyPayload, getAccessToken]
  );

  const activeView = useMemo(() => {
    if (!storage) return null;
    return (
      storage.views.find((view) => view.id === storage.activeViewId) ??
      storage.views[0] ??
      null
    );
  }, [storage]);

  // On each login / fresh page load, open the shared All view with its saved settings.
  useEffect(() => {
    if (!ready || !hasLoaded || !storage || initialAppliedRef.current) return;
    initialAppliedRef.current = true;

    const allView =
      storage.views.find((view) => isDefaultCoachTableViewName(view.name)) ??
      storage.views[0];
    if (!allView) return;

    applyingViewRef.current = true;
    onApplySettingsRef.current(settingsForView(allView));

    if (storage.activeViewId !== allView.id) {
      setStorage((prev) =>
        prev ? { ...prev, activeViewId: allView.id } : prev
      );
      void (async () => {
        try {
          await runMutation((token) =>
            updateCoachTableViewPreferencesRemote(token, {
              activeViewId: allView.id,
            })
          );
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Unable to open All view."
          );
        } finally {
          queueMicrotask(() => {
            applyingViewRef.current = false;
          });
        }
      })();
      return;
    }

    queueMicrotask(() => {
      applyingViewRef.current = false;
    });
  }, [hasLoaded, ready, runMutation, storage]);

  const canEditActiveView = Boolean(activeView?.canEdit);

  const isDirty = useMemo(() => {
    if (!activeView) return false;
    return !coachTableViewSettingsEqual(
      currentSettings,
      settingsForView(activeView)
    );
  }, [activeView, currentSettings]);

  const updateActiveViewSettings = useCallback(
    async (settings: CoachTableViewSettings) => {
      if (!storage || !activeView || !activeView.canEdit) {
        return;
      }
      await runMutation((token) =>
        updateCoachTableViewRemote(token, activeView.id, { settings })
      );
    },
    [activeView, runMutation, storage]
  );

  useEffect(() => {
    if (
      !hasLoaded ||
      !storage?.autosave ||
      !canEditActiveView ||
      !isDirty
    ) {
      return;
    }
    if (applyingViewRef.current) return;
    void updateActiveViewSettings(currentSettings);
  }, [
    canEditActiveView,
    currentSettings,
    hasLoaded,
    isDirty,
    storage?.autosave,
    updateActiveViewSettings,
  ]);

  const switchView = useCallback(
    async (viewId: string) => {
      if (!storage || viewId === storage.activeViewId) return;
      const view = storage.views.find((v) => v.id === viewId);
      if (!view) return;
      applyingViewRef.current = true;
      onApplySettingsRef.current(settingsForView(view));
      try {
        await runMutation((token) =>
          updateCoachTableViewPreferencesRemote(token, { activeViewId: viewId })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to switch view.");
      } finally {
        queueMicrotask(() => {
          applyingViewRef.current = false;
        });
      }
    },
    [runMutation, storage]
  );

  const allView = useMemo(
    () =>
      storage?.views.find((view) => isDefaultCoachTableViewName(view.name)) ??
      null,
    [storage?.views]
  );

  const canUpdateAllView = useMemo(() => {
    if (!allView) return false;
    return !coachTableViewSettingsEqual(
      currentSettings,
      settingsForView(allView)
    );
  }, [allView, currentSettings]);

  const saveView = useCallback(async () => {
    if (!activeView) {
      setError("No active view to save.");
      return;
    }
    if (!activeView.canEdit) {
      setError("This view is read-only.");
      return;
    }
    try {
      setError(null);
      await runMutation((token) =>
        updateCoachTableViewRemote(token, activeView.id, {
          settings: currentSettings,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save view.");
    }
  }, [activeView, currentSettings, runMutation]);

  /** Push the current table settings onto the shared All view (from any tab). */
  const updateAllView = useCallback(async () => {
    if (!allView) {
      setError("All view not found.");
      return;
    }
    try {
      setError(null);
      await runMutation((token) =>
        updateCoachTableViewRemote(token, allView.id, {
          settings: currentSettings,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update All view."
      );
    }
  }, [allView, currentSettings, runMutation]);

  const saveAsNewView = useCallback(
    async (name: string, isPrivate = false) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      applyingViewRef.current = true;
      onApplySettingsRef.current(currentSettings);
      try {
        setError(null);
        await runMutation((token) =>
          createCoachTableViewRemote(token, {
            name: trimmed,
            settings: currentSettings,
            isPrivate,
            makeActive: true,
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save view.");
      } finally {
        queueMicrotask(() => {
          applyingViewRef.current = false;
        });
      }
    },
    [currentSettings, runMutation]
  );

  const revertChanges = useCallback(() => {
    if (!activeView) return;
    applyingViewRef.current = true;
    onApplySettingsRef.current(settingsForView(activeView));
    queueMicrotask(() => {
      applyingViewRef.current = false;
    });
  }, [activeView]);

  const toggleAutosave = useCallback(async () => {
    if (!storage) return;
    const nextAutosave = !storage.autosave;
    try {
      if (nextAutosave && isDirty && activeView?.canEdit) {
        await updateActiveViewSettings(currentSettings);
      }
      await runMutation((token) =>
        updateCoachTableViewPreferencesRemote(token, { autosave: nextAutosave })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update autosave.");
    }
  }, [
    activeView?.canEdit,
    currentSettings,
    isDirty,
    runMutation,
    storage,
    updateActiveViewSettings,
  ]);

  const addViewFromCurrent = useCallback(
    async (name: string, isPrivate = false) => {
      await saveAsNewView(name, isPrivate);
    },
    [saveAsNewView]
  );

  const renameView = useCallback(
    async (viewId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view?.canEdit || isDefaultCoachTableViewName(view.name)) return;
      if (isDefaultCoachTableViewName(trimmed)) {
        setError('Reserved view name "All". Choose another name.');
        return;
      }
      try {
        await runMutation((token) =>
          updateCoachTableViewRemote(token, viewId, { name: trimmed })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to rename view.");
      }
    },
    [runMutation, storage?.views]
  );

  const setViewPrivacy = useCallback(
    async (viewId: string, isPrivate: boolean) => {
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view?.canEdit || isDefaultCoachTableViewName(view.name)) return;
      try {
        await runMutation((token) =>
          updateCoachTableViewRemote(token, viewId, { isPrivate })
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to update view privacy."
        );
      }
    },
    [runMutation, storage?.views]
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      if (!storage || storage.views.length <= 1) return;
      const view = storage.views.find((row) => row.id === viewId);
      if (!view?.canEdit || isDefaultCoachTableViewName(view.name)) return;
      const deletingActive = storage.activeViewId === viewId;
      try {
        const payload = await runMutation((token) =>
          deleteCoachTableViewRemote(token, viewId)
        );
        if (deletingActive) {
          const nextActive =
            payload.views.find((row) => row.id === payload.activeViewId) ??
            payload.views[0];
          if (nextActive) {
            applyingViewRef.current = true;
            onApplySettingsRef.current(settingsForView(nextActive));
            queueMicrotask(() => {
              applyingViewRef.current = false;
            });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to delete view.");
      }
    },
    [runMutation, storage]
  );

  const reorderViews = useCallback(
    async (orderedViewIds: string[]) => {
      if (!storage) return;
      const nextOrder = orderedViewIds.filter((id) => {
        const view = storage.views.find((row) => row.id === id);
        return Boolean(view && !isDefaultCoachTableViewName(view.name));
      });
      const nextViews = orderCoachTableViews(storage.views, nextOrder);
      setStorage({
        ...storage,
        views: nextViews,
        viewOrder: nextOrder,
      });
      try {
        await runMutation((token) =>
          updateCoachTableViewPreferencesRemote(token, { viewOrder: nextOrder })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to reorder views.");
      }
    },
    [runMutation, storage]
  );

  const importViews = useCallback(
    async (next: CoachTableViewsStorage) => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Missing access token.");
        for (const view of next.views) {
          if (isDefaultCoachTableViewName(view.name)) continue;
          await createCoachTableViewRemote(token, {
            name: view.name,
            settings: view.settings,
            isPrivate: view.isPrivate ?? true,
          });
        }
        const payload = await fetchCoachTableViews(token);
        applyPayload(payload);
        const active =
          payload.views.find((view) => view.id === next.activeViewId) ??
          payload.views[0];
        if (active) {
          applyingViewRef.current = true;
          onApplySettingsRef.current(settingsForView(active));
          await updateCoachTableViewPreferencesRemote(token, {
            activeViewId: active.id,
            autosave: next.autosave,
            viewOrder: next.viewOrder,
          });
          const refreshed = await fetchCoachTableViews(token);
          applyPayload(refreshed);
          queueMicrotask(() => {
            applyingViewRef.current = false;
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to import views.");
      }
    },
    [applyPayload, getAccessToken]
  );

  return {
    views: storage?.views ?? [],
    activeViewId: storage?.activeViewId ?? null,
    activeView,
    allView,
    autosave: storage?.autosave ?? false,
    currentUserId,
    canEditActiveView,
    canUpdateAllView,
    hasLoaded,
    loading,
    error,
    isDirty,
    storage: storage
      ? {
          version: 1 as const,
          views: storage.views,
          activeViewId: storage.activeViewId,
          autosave: storage.autosave,
          viewOrder: storage.viewOrder,
        }
      : null,
    refreshViews,
    switchView,
    saveView,
    updateAllView,
    saveAsNewView,
    revertChanges,
    toggleAutosave,
    addViewFromCurrent,
    renameView,
    setViewPrivacy,
    deleteView,
    reorderViews,
    importViews,
  };
}
