"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPoolTableViewRemote,
  deletePoolTableViewRemote,
  fetchPoolTableViews,
  updatePoolTableViewPreferencesRemote,
  updatePoolTableViewRemote,
} from "@/lib/pool/poolTableViewsClient";
import {
  createDefaultPoolTableViewSettings,
  createPoolTableView,
  DEFAULT_POOL_TABLE_VIEW_NAME,
  isDefaultProspectTableViewName,
  nonAllPoolViewOrder,
  orderPoolTableViews,
  poolTableViewSettingsEqual,
  uniquePoolViewCopyName,
  type PoolTableView,
  type PoolTableViewSettings,
  type PoolTableViewsPayload,
  type PoolTableViewsStorage,
} from "@/lib/pool/poolTableViews";

type Args = {
  currentSettings: PoolTableViewSettings;
  onApplySettings: (settings: PoolTableViewSettings) => void;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  ready?: boolean;
};

function payloadToStorage(payload: PoolTableViewsPayload): PoolTableViewsStorage {
  const viewOrder = Array.isArray(payload.viewOrder)
    ? payload.viewOrder
    : nonAllPoolViewOrder(payload.views);
  const views = orderPoolTableViews(payload.views, viewOrder);
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
    viewOrder: nonAllPoolViewOrder(views),
  };
}

export function usePoolTableViews({
  currentSettings,
  onApplySettings,
  getAuthHeaders,
  ready = true,
}: Args) {
  const [storage, setStorage] = useState<PoolTableViewsStorage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const applyingViewRef = useRef(false);
  const onApplySettingsRef = useRef(onApplySettings);
  onApplySettingsRef.current = onApplySettings;

  const applyPayload = useCallback((payload: PoolTableViewsPayload) => {
    setStorage(payloadToStorage(payload));
  }, []);

  const runMutation = useCallback(
    async (
      mutate: (headers: Record<string, string>) => Promise<PoolTableViewsPayload>
    ) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Missing access token.");
      const payload = await mutate(headers);
      applyPayload(payload);
      return payload;
    },
    [applyPayload, getAuthHeaders]
  );

  useEffect(() => {
    if (!ready || hasLoaded) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        if (!headers) {
          const defaults = createDefaultPoolTableViewSettings();
          const allView = createPoolTableView(DEFAULT_POOL_TABLE_VIEW_NAME, defaults, {
            canEdit: true,
          });
          if (cancelled) return;
          setStorage({
            version: 1,
            views: [allView],
            activeViewId: allView.id,
            autosave: true,
            viewOrder: [],
          });
          onApplySettingsRef.current(defaults);
          return;
        }
        const payload = await fetchPoolTableViews(headers);
        if (cancelled) return;
        applyPayload(payload);
        const active =
          payload.views.find((view) => view.id === payload.activeViewId) ??
          payload.views[0];
        if (active) onApplySettingsRef.current(active.settings);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load views.");
        const defaults = createDefaultPoolTableViewSettings();
        const allView = createPoolTableView(DEFAULT_POOL_TABLE_VIEW_NAME, defaults, {
          canEdit: true,
        });
        setStorage({
          version: 1,
          views: [allView],
          activeViewId: allView.id,
          autosave: true,
          viewOrder: [],
        });
        onApplySettingsRef.current(defaults);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasLoaded(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyPayload, getAuthHeaders, hasLoaded, ready]);

  const views = storage?.views ?? [];
  const activeView =
    views.find((view) => view.id === storage?.activeViewId) ?? views[0] ?? null;
  const isDirty = Boolean(
    activeView &&
      !poolTableViewSettingsEqual(currentSettings, activeView.settings)
  );

  const updateActiveViewSettings = useCallback(
    async (settings: PoolTableViewSettings) => {
      if (!activeView?.canEdit) return;
      await runMutation((headers) =>
        updatePoolTableViewRemote(headers, activeView.id, { settings })
      );
    },
    [activeView, runMutation]
  );

  const switchView = useCallback(
    async (viewId: string) => {
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view) return;
      if (viewId !== storage?.activeViewId && isDirty && activeView?.canEdit) {
        try {
          await updateActiveViewSettings(currentSettings);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Unable to autosave view."
          );
          return;
        }
      }
      applyingViewRef.current = true;
      onApplySettingsRef.current(view.settings);
      try {
        await runMutation((headers) =>
          updatePoolTableViewPreferencesRemote(headers, { activeViewId: viewId })
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
      storage?.activeViewId,
      storage?.views,
      updateActiveViewSettings,
    ]
  );

  useEffect(() => {
    if (!isDirty || !activeView?.canEdit) return;
    if (applyingViewRef.current) return;
    const handle = window.setTimeout(() => {
      void updateActiveViewSettings(currentSettings).catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to autosave view.");
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [activeView?.canEdit, currentSettings, isDirty, updateActiveViewSettings]);

  const addViewFromCurrent = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      applyingViewRef.current = true;
      onApplySettingsRef.current(currentSettings);
      try {
        setError(null);
        await runMutation((headers) =>
          createPoolTableViewRemote(headers, {
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
    [currentSettings, runMutation]
  );

  const duplicateView = useCallback(
    async (viewId: string) => {
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view) return;
      const settings =
        viewId === storage?.activeViewId ? currentSettings : view.settings;
      const name = uniquePoolViewCopyName(
        view.name,
        (storage?.views ?? []).map((row) => row.name)
      );
      applyingViewRef.current = true;
      onApplySettingsRef.current(settings);
      try {
        setError(null);
        await runMutation((headers) =>
          createPoolTableViewRemote(headers, {
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
    [currentSettings, runMutation, storage?.activeViewId, storage?.views]
  );

  const saveView = useCallback(async () => {
    if (!activeView?.canEdit) return;
    try {
      setError(null);
      await updateActiveViewSettings(currentSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save view.");
    }
  }, [activeView?.canEdit, currentSettings, updateActiveViewSettings]);

  const saveAsNewView = useCallback(
    async (name: string) => {
      await addViewFromCurrent(name);
    },
    [addViewFromCurrent]
  );

  const updateAllView = useCallback(async () => {
    const allView = views.find((view) =>
      isDefaultProspectTableViewName(view.name)
    );
    if (!allView) return;
    try {
      setError(null);
      await runMutation((headers) =>
        updatePoolTableViewRemote(headers, allView.id, {
          settings: currentSettings,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update All.");
    }
  }, [currentSettings, runMutation, views]);

  const revertChanges = useCallback(() => {
    if (!activeView) return;
    applyingViewRef.current = true;
    onApplySettingsRef.current(activeView.settings);
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
        updatePoolTableViewPreferencesRemote(headers, { autosave: nextAutosave })
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

  const renameView = useCallback(
    async (viewId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view?.canEdit || isDefaultProspectTableViewName(view.name)) return;
      try {
        await runMutation((headers) =>
          updatePoolTableViewRemote(headers, viewId, { name: trimmed })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to rename view.");
      }
    },
    [runMutation, storage?.views]
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      const view = storage?.views.find((row) => row.id === viewId);
      if (!view?.canEdit || isDefaultProspectTableViewName(view.name)) return;
      try {
        await runMutation((headers) => deletePoolTableViewRemote(headers, viewId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to delete view.");
      }
    },
    [runMutation, storage?.views]
  );

  const reorderViews = useCallback(
    async (orderedViewIds: string[]) => {
      try {
        await runMutation((headers) =>
          updatePoolTableViewPreferencesRemote(headers, {
            viewOrder: orderedViewIds,
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to reorder views.");
      }
    },
    [runMutation]
  );

  return useMemo(
    () => ({
      views,
      activeView,
      activeViewId: storage?.activeViewId ?? null,
      autosave: true,
      isDirty,
      loading,
      error,
      canEditActiveView: Boolean(activeView?.canEdit),
      canUpdateAllView: Boolean(
        views.find((view) => isDefaultProspectTableViewName(view.name))
      ),
      switchView,
      addViewFromCurrent,
      duplicateView,
      saveView,
      saveAsNewView,
      updateAllView,
      revertChanges,
      toggleAutosave,
      renameView,
      deleteView,
      reorderViews,
    }),
    [
      activeView,
      addViewFromCurrent,
      duplicateView,
      deleteView,
      error,
      isDirty,
      loading,
      renameView,
      reorderViews,
      revertChanges,
      saveAsNewView,
      saveView,
      storage?.activeViewId,
      storage?.autosave,
      switchView,
      toggleAutosave,
      updateAllView,
      views,
    ]
  );
}
