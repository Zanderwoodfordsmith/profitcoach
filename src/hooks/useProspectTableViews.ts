"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProspectTableViewRemote,
  deleteProspectTableViewRemote,
  fetchProspectTableViews,
  updateProspectTableViewPreferencesRemote,
  updateProspectTableViewRemote,
} from "@/lib/prospects/prospectTableViewsClient";
import {
  createDefaultProspectTableViewSettings,
  createProspectSmartListSettings,
  createProspectTableView,
  DEFAULT_PROSPECT_SMART_LISTS,
  DEFAULT_PROSPECT_TABLE_VIEW_NAME,
  isDefaultProspectTableViewName,
  isProtectedProspectViewName,
  nonAllProspectViewOrder,
  orderProspectTableViews,
  prospectTableViewSettingsEqual,
  PROSPECT_TABLE_VIEWS_MIGRATED_KEY,
  uniqueProspectViewCopyName,
  type ProspectTableView,
  type ProspectTableViewSettings,
  type ProspectTableViewSurface,
  type ProspectTableViewsPayload,
  type ProspectTableViewsStorage,
} from "@/lib/prospects/prospectTableViews";
import {
  loadProspectGrouping,
  PROSPECTS_GROUP_STORAGE_KEY,
} from "@/lib/prospects/prospectGrouping";
import {
  parsePersistedColumnSettings,
} from "@/hooks/usePersistedColumnSettings";
import {
  ALL_PROSPECT_COLUMN_KEYS,
  DEFAULT_PROSPECT_COLUMN_ORDER,
  DEFAULT_PROSPECT_COLUMN_VISIBILITY,
  PROSPECT_COLUMN_LEGACY_KEY_MAP,
  PROSPECTS_TABLE_SETTINGS_STORAGE_KEY,
} from "@/lib/prospects/prospectTableColumns";

function settingsForView(view: ProspectTableView): ProspectTableViewSettings {
  return view.settings;
}

function payloadToStorage(
  payload: ProspectTableViewsPayload
): ProspectTableViewsStorage {
  const viewOrder = Array.isArray(payload.viewOrder)
    ? payload.viewOrder
    : nonAllProspectViewOrder(payload.views);
  const views = orderProspectTableViews(payload.views, viewOrder);
  const allViewId = views.find((view) =>
    isDefaultProspectTableViewName(view.name)
  )?.id;
  const activeViewId = views.some((view) => view.id === payload.activeViewId)
    ? payload.activeViewId
    : allViewId ?? views[0]?.id ?? payload.activeViewId;
  return {
    version: 1,
    views,
    activeViewId,
    autosave: true,
    viewOrder: nonAllProspectViewOrder(views),
  };
}

function loadLegacyLocalSettings(): ProspectTableViewSettings | null {
  if (typeof window === "undefined") return null;
  const defaults = createDefaultProspectTableViewSettings();
  const next = { ...defaults };
  let found = false;

  const columnsRaw = window.localStorage.getItem(
    PROSPECTS_TABLE_SETTINGS_STORAGE_KEY
  );
  if (columnsRaw) {
    const parsed = parsePersistedColumnSettings(columnsRaw, {
      validKeys: ALL_PROSPECT_COLUMN_KEYS,
      defaultVisibility: DEFAULT_PROSPECT_COLUMN_VISIBILITY,
      defaultOrder: DEFAULT_PROSPECT_COLUMN_ORDER,
      legacyKeyMap: PROSPECT_COLUMN_LEGACY_KEY_MAP,
    });
    if (parsed) {
      next.columnVisibility = parsed.columnVisibility;
      next.columnOrder = parsed.columnOrder;
      found = true;
    }
  }

  if (window.localStorage.getItem(PROSPECTS_GROUP_STORAGE_KEY)) {
    next.grouping = loadProspectGrouping();
    found = true;
  }

  return found ? next : null;
}

type UseProspectTableViewsOptions = {
  surface: ProspectTableViewSurface;
  currentSettings: ProspectTableViewSettings;
  onApplySettings: (settings: ProspectTableViewSettings) => void;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  ready: boolean;
};

export function useProspectTableViews({
  surface,
  currentSettings,
  onApplySettings,
  getAuthHeaders,
  ready,
}: UseProspectTableViewsOptions) {
  const [storage, setStorage] = useState<ProspectTableViewsStorage | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applyingViewRef = useRef(false);
  const initialAppliedRef = useRef(false);
  const onApplySettingsRef = useRef(onApplySettings);
  onApplySettingsRef.current = onApplySettings;

  const applyPayload = useCallback((payload: ProspectTableViewsPayload) => {
    setCurrentUserId(payload.currentUserId);
    setStorage(payloadToStorage(payload));
  }, []);

  const runMutation = useCallback(
    async (
      mutate: (
        headers: Record<string, string>
      ) => Promise<ProspectTableViewsPayload>
    ) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Missing access token.");
      const payload = await mutate(headers);
      applyPayload(payload);
      return payload;
    },
    [applyPayload, getAuthHeaders]
  );

  const migrateLocalSettingsIfNeeded = useCallback(
    async (headers: Record<string, string>, payload: ProspectTableViewsPayload) => {
      if (typeof window === "undefined") return payload;
      const migratedKey = `${PROSPECT_TABLE_VIEWS_MIGRATED_KEY}:${surface}`;
      if (window.localStorage.getItem(migratedKey) === "1") {
        return payload;
      }

      const local = loadLegacyLocalSettings();
      const allView = payload.views.find((view) =>
        isDefaultProspectTableViewName(view.name)
      );
      window.localStorage.setItem(migratedKey, "1");
      if (!local || !allView) return payload;

      const defaults = createDefaultProspectTableViewSettings();
      if (!prospectTableViewSettingsEqual(allView.settings, defaults)) {
        return payload;
      }
      if (prospectTableViewSettingsEqual(local, defaults)) {
        return payload;
      }

      return updateProspectTableViewRemote(headers, surface, allView.id, {
        settings: local,
      });
    },
    [surface]
  );

  useEffect(() => {
    if (!ready || hasLoaded) return;
    let cancelled = false;

    function seedLocalAllView() {
      const defaults = createDefaultProspectTableViewSettings();
      const local = loadLegacyLocalSettings() ?? defaults;
      const allView = createProspectTableView(
        DEFAULT_PROSPECT_TABLE_VIEW_NAME,
        local,
        { canEdit: true }
      );
      const smartViews = DEFAULT_PROSPECT_SMART_LISTS.map((list) =>
        createProspectTableView(
          list.name,
          createProspectSmartListSettings(list.statusFilter),
          { canEdit: true }
        )
      );
      setStorage({
        version: 1,
        views: [allView, ...smartViews],
        activeViewId: allView.id,
        autosave: true,
        viewOrder: smartViews.map((view) => view.id),
      });
      onApplySettingsRef.current(local);
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        if (!headers) throw new Error("Missing access token.");
        const loaded = await fetchProspectTableViews(headers, surface);
        const payload = await migrateLocalSettingsIfNeeded(headers, loaded);
        if (cancelled) return;
        applyPayload(payload);
        setHasLoaded(true);
      } catch (err) {
        if (cancelled) return;
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
    getAuthHeaders,
    hasLoaded,
    migrateLocalSettingsIfNeeded,
    ready,
    surface,
  ]);

  const activeView = useMemo(() => {
    if (!storage) return null;
    return (
      storage.views.find((view) => view.id === storage.activeViewId) ??
      storage.views[0] ??
      null
    );
  }, [storage]);

  useEffect(() => {
    if (!ready || !hasLoaded || !storage || initialAppliedRef.current) return;
    initialAppliedRef.current = true;

    const allView =
      storage.views.find((view) => isDefaultProspectTableViewName(view.name)) ??
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
          await runMutation((headers) =>
            updateProspectTableViewPreferencesRemote(headers, surface, {
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
  }, [hasLoaded, ready, runMutation, storage, surface]);

  const canEditActiveView = Boolean(activeView?.canEdit);

  const isDirty = useMemo(() => {
    if (!activeView) return false;
    return !prospectTableViewSettingsEqual(
      currentSettings,
      settingsForView(activeView)
    );
  }, [activeView, currentSettings]);

  const updateActiveViewSettings = useCallback(
    async (settings: ProspectTableViewSettings) => {
      if (!storage || !activeView || !activeView.canEdit) return;
      await runMutation((headers) =>
        updateProspectTableViewRemote(headers, surface, activeView.id, {
          settings,
        })
      );
    },
    [activeView, runMutation, storage, surface]
  );

  const switchView = useCallback(
    async (viewId: string) => {
      if (!storage || viewId === storage.activeViewId) return;
      const view = storage.views.find((row) => row.id === viewId);
      if (!view) return;
      if (isDirty && activeView?.canEdit) {
        try {
          await updateActiveViewSettings(currentSettings);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Unable to autosave view."
          );
        }
      }
      applyingViewRef.current = true;
      onApplySettingsRef.current(settingsForView(view));
      setStorage((prev) =>
        prev ? { ...prev, activeViewId: viewId } : prev
      );
      try {
        await runMutation((headers) =>
          updateProspectTableViewPreferencesRemote(headers, surface, {
            activeViewId: viewId,
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to switch view.");
      } finally {
        queueMicrotask(() => {
          applyingViewRef.current = false;
        });
      }
    },
    [
      activeView?.canEdit,
      currentSettings,
      isDirty,
      runMutation,
      storage,
      surface,
      updateActiveViewSettings,
    ]
  );

  useEffect(() => {
    if (!hasLoaded || !canEditActiveView || !isDirty) return;
    if (applyingViewRef.current) return;
    const handle = window.setTimeout(() => {
      void updateActiveViewSettings(currentSettings).catch((err) => {
        setError(
          err instanceof Error ? err.message : "Unable to autosave view."
        );
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [
    canEditActiveView,
    currentSettings,
    hasLoaded,
    isDirty,
    updateActiveViewSettings,
  ]);

  const allView = useMemo(
    () =>
      storage?.views.find((view) =>
        isDefaultProspectTableViewName(view.name)
      ) ?? null,
    [storage?.views]
  );

  const canUpdateAllView = useMemo(() => {
    if (!allView) return false;
    return !prospectTableViewSettingsEqual(
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
      await runMutation((headers) =>
        updateProspectTableViewRemote(headers, surface, activeView.id, {
          settings: currentSettings,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save view.");
    }
  }, [activeView, currentSettings, runMutation, surface]);

  const updateAllView = useCallback(async () => {
    if (!allView) {
      setError("All view not found.");
      return;
    }
    try {
      setError(null);
      await runMutation((headers) =>
        updateProspectTableViewRemote(headers, surface, allView.id, {
          settings: currentSettings,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update All view."
      );
    }
  }, [allView, currentSettings, runMutation, surface]);

  const saveAsNewView = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      applyingViewRef.current = true;
      onApplySettingsRef.current(currentSettings);
      try {
        setError(null);
        await runMutation((headers) =>
          createProspectTableViewRemote(headers, surface, {
            name: trimmed,
            settings: currentSettings,
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
    [currentSettings, runMutation, surface]
  );

  const duplicateView = useCallback(
    async (viewId: string) => {
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view) return;
      const settings =
        viewId === storage?.activeViewId ? currentSettings : view.settings;
      const name = uniqueProspectViewCopyName(
        view.name,
        (storage?.views ?? []).map((row) => row.name)
      );
      applyingViewRef.current = true;
      onApplySettingsRef.current(settings);
      try {
        setError(null);
        await runMutation((headers) =>
          createProspectTableViewRemote(headers, surface, {
            name,
            settings,
            makeActive: true,
          })
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to duplicate view."
        );
      } finally {
        queueMicrotask(() => {
          applyingViewRef.current = false;
        });
      }
    },
    [currentSettings, runMutation, storage?.activeViewId, storage?.views, surface]
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
      await runMutation((headers) =>
        updateProspectTableViewPreferencesRemote(headers, surface, {
          autosave: nextAutosave,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update autosave."
      );
    }
  }, [
    activeView?.canEdit,
    currentSettings,
    isDirty,
    runMutation,
    storage,
    surface,
    updateActiveViewSettings,
  ]);

  const renameView = useCallback(
    async (viewId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view?.canEdit || isProtectedProspectViewName(view.name)) return;
      if (isProtectedProspectViewName(trimmed)) {
        setError(`Reserved view name "${trimmed}". Choose another name.`);
        return;
      }
      try {
        await runMutation((headers) =>
          updateProspectTableViewRemote(headers, surface, viewId, {
            name: trimmed,
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to rename view.");
      }
    },
    [runMutation, storage?.views, surface]
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      if (!storage || storage.views.length <= 1) return;
      const view = storage.views.find((row) => row.id === viewId);
      if (!view?.canEdit || isProtectedProspectViewName(view.name)) return;
      const deletingActive = storage.activeViewId === viewId;
      try {
        const payload = await runMutation((headers) =>
          deleteProspectTableViewRemote(headers, surface, viewId)
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
    [runMutation, storage, surface]
  );

  const reorderViews = useCallback(
    async (orderedViewIds: string[]) => {
      if (!storage) return;
      const nextOrder = orderedViewIds.filter((id) => {
        const view = storage.views.find((row) => row.id === id);
        return Boolean(view && !isDefaultProspectTableViewName(view.name));
      });
      const nextViews = orderProspectTableViews(storage.views, nextOrder);
      setStorage({
        ...storage,
        views: nextViews,
        viewOrder: nextOrder,
      });
      try {
        await runMutation((headers) =>
          updateProspectTableViewPreferencesRemote(headers, surface, {
            viewOrder: nextOrder,
          })
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to reorder views."
        );
      }
    },
    [runMutation, storage, surface]
  );

  return {
    views: storage?.views ?? [],
    activeViewId: storage?.activeViewId ?? null,
    activeView,
    allView,
    autosave: true,
    currentUserId,
    canEditActiveView,
    canUpdateAllView,
    hasLoaded,
    loading,
    error,
    isDirty,
    switchView,
    saveView,
    updateAllView,
    saveAsNewView,
    revertChanges,
    toggleAutosave,
    addViewFromCurrent: saveAsNewView,
    duplicateView,
    renameView,
    deleteView,
    reorderViews,
  };
}
