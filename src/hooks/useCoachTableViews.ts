"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COACH_TABLE_VIEWS_STORAGE_KEY,
  DEFAULT_COACH_TABLE_VIEW_NAME,
  LEGACY_COACH_TABLE_SETTINGS_KEY,
  coachTableViewSettingsEqual,
  createCoachTableView,
  generateCoachTableViewId,
  type CoachTableView,
  type CoachTableViewSettings,
  type CoachTableViewsStorage,
} from "@/lib/admin/coachTableViews";
import { normalizeCoachTableViewSettings } from "@/lib/admin/coachTableSort";

type UseCoachTableViewsOptions = {
  currentSettings: CoachTableViewSettings;
  onApplySettings: (settings: CoachTableViewSettings) => void;
  createDefaultSettings: () => CoachTableViewSettings;
  /** Parse legacy single-view localStorage payload */
  migrateLegacySettings?: (raw: string) => CoachTableViewSettings | null;
  /** Gate applying persisted views until table column keys etc. are ready */
  ready: boolean;
};

function createDefaultStorage(
  settings: CoachTableViewSettings
): CoachTableViewsStorage {
  const id = generateCoachTableViewId();
  return {
    version: 1,
    views: [
      {
        id,
        name: DEFAULT_COACH_TABLE_VIEW_NAME,
        settings,
      },
    ],
    activeViewId: id,
    autosave: false,
  };
}

function parseViewsStorage(raw: string): CoachTableViewsStorage | null {
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
      views,
      activeViewId,
      autosave: parsed.autosave === true,
    };
  } catch {
    return null;
  }
}

function loadViewsStorage(
  createDefaultSettings: () => CoachTableViewSettings,
  migrateLegacySettings?: (raw: string) => CoachTableViewSettings | null
): CoachTableViewsStorage {
  if (typeof window === "undefined") {
    return createDefaultStorage(createDefaultSettings());
  }

  const rawV1 = window.localStorage.getItem(COACH_TABLE_VIEWS_STORAGE_KEY);
  if (rawV1) {
    const parsed = parseViewsStorage(rawV1);
    if (parsed) return parsed;
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_COACH_TABLE_SETTINGS_KEY);
  if (legacyRaw && migrateLegacySettings) {
    const migrated = migrateLegacySettings(legacyRaw);
    if (migrated) return createDefaultStorage(migrated);
  }

  return createDefaultStorage(createDefaultSettings());
}

export function useCoachTableViews({
  currentSettings,
  onApplySettings,
  createDefaultSettings,
  migrateLegacySettings,
  ready,
}: UseCoachTableViewsOptions) {
  const [storage, setStorage] = useState<CoachTableViewsStorage | null>(() => {
    if (typeof window === "undefined") return null;
    return loadViewsStorage(createDefaultSettings, migrateLegacySettings);
  });
  const [hasLoaded, setHasLoaded] = useState(() => typeof window !== "undefined");
  const applyingViewRef = useRef(false);
  const initialAppliedRef = useRef(false);
  const onApplySettingsRef = useRef(onApplySettings);
  onApplySettingsRef.current = onApplySettings;

  useEffect(() => {
    if (typeof window === "undefined" || hasLoaded) return;
    const loaded = loadViewsStorage(createDefaultSettings, migrateLegacySettings);
    setStorage(loaded);
    setHasLoaded(true);
  }, [createDefaultSettings, hasLoaded, migrateLegacySettings]);

  const activeView = useMemo(() => {
    if (!storage) return null;
    return (
      storage.views.find((view) => view.id === storage.activeViewId) ??
      storage.views[0] ??
      null
    );
  }, [storage]);

  useEffect(() => {
    if (!ready || !hasLoaded || !activeView || initialAppliedRef.current) return;
    initialAppliedRef.current = true;
    applyingViewRef.current = true;
    onApplySettingsRef.current(activeView.settings);
    queueMicrotask(() => {
      applyingViewRef.current = false;
    });
  }, [activeView, hasLoaded, ready]);

  const isDirty = useMemo(() => {
    if (!activeView) return false;
    return !coachTableViewSettingsEqual(currentSettings, activeView.settings);
  }, [activeView, currentSettings]);

  const persistStorage = useCallback((next: CoachTableViewsStorage) => {
    setStorage(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        COACH_TABLE_VIEWS_STORAGE_KEY,
        JSON.stringify(next)
      );
    }
  }, []);

  const updateActiveViewSettings = useCallback(
    (settings: CoachTableViewSettings) => {
      if (!storage || !activeView) return;
      const views = storage.views.map((view) =>
        view.id === activeView.id ? { ...view, settings } : view
      );
      persistStorage({ ...storage, views });
    },
    [activeView, persistStorage, storage]
  );

  useEffect(() => {
    if (!hasLoaded || !storage?.autosave || !activeView || !isDirty) return;
    if (applyingViewRef.current) return;
    updateActiveViewSettings(currentSettings);
  }, [
    activeView,
    currentSettings,
    hasLoaded,
    isDirty,
    storage?.autosave,
    updateActiveViewSettings,
  ]);

  const switchView = useCallback(
    (viewId: string) => {
      if (!storage || viewId === storage.activeViewId) return;
      const view = storage.views.find((v) => v.id === viewId);
      if (!view) return;
      applyingViewRef.current = true;
      onApplySettingsRef.current(view.settings);
      persistStorage({ ...storage, activeViewId: viewId });
      queueMicrotask(() => {
        applyingViewRef.current = false;
      });
    },
    [persistStorage, storage]
  );

  const saveView = useCallback(() => {
    updateActiveViewSettings(currentSettings);
  }, [currentSettings, updateActiveViewSettings]);

  const saveAsNewView = useCallback(
    (name: string) => {
      if (!storage) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const view = createCoachTableView(trimmed, currentSettings);
      persistStorage({
        ...storage,
        views: [...storage.views, view],
        activeViewId: view.id,
      });
      applyingViewRef.current = true;
      onApplySettingsRef.current(view.settings);
      queueMicrotask(() => {
        applyingViewRef.current = false;
      });
    },
    [currentSettings, persistStorage, storage]
  );

  const revertChanges = useCallback(() => {
    if (!activeView) return;
    applyingViewRef.current = true;
    onApplySettingsRef.current(activeView.settings);
    queueMicrotask(() => {
      applyingViewRef.current = false;
    });
  }, [activeView]);

  const toggleAutosave = useCallback(() => {
    if (!storage) return;
    const nextAutosave = !storage.autosave;
    if (nextAutosave && isDirty) {
      updateActiveViewSettings(currentSettings);
    }
    persistStorage({ ...storage, autosave: nextAutosave });
  }, [
    currentSettings,
    isDirty,
    persistStorage,
    storage,
    updateActiveViewSettings,
  ]);

  const addViewFromCurrent = useCallback(
    (name: string) => {
      saveAsNewView(name);
    },
    [saveAsNewView]
  );

  const renameView = useCallback(
    (viewId: string, name: string) => {
      if (!storage) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const views = storage.views.map((view) =>
        view.id === viewId ? { ...view, name: trimmed } : view
      );
      persistStorage({ ...storage, views });
    },
    [persistStorage, storage]
  );

  const deleteView = useCallback(
    (viewId: string) => {
      if (!storage || storage.views.length <= 1) return;
      const remaining = storage.views.filter((view) => view.id !== viewId);
      if (remaining.length === storage.views.length) return;
      const deletingActive = storage.activeViewId === viewId;
      const nextActiveId = deletingActive
        ? remaining[0].id
        : storage.activeViewId;
      const nextActive = remaining.find((view) => view.id === nextActiveId);
      if (deletingActive && nextActive) {
        applyingViewRef.current = true;
        onApplySettingsRef.current(nextActive.settings);
        queueMicrotask(() => {
          applyingViewRef.current = false;
        });
      }
      persistStorage({
        ...storage,
        views: remaining,
        activeViewId: nextActiveId,
      });
    },
    [persistStorage, storage]
  );

  const importViews = useCallback(
    (next: CoachTableViewsStorage) => {
      persistStorage(next);
      const active =
        next.views.find((view) => view.id === next.activeViewId) ??
        next.views[0];
      if (active) {
        applyingViewRef.current = true;
        onApplySettingsRef.current(active.settings);
        queueMicrotask(() => {
          applyingViewRef.current = false;
        });
      }
    },
    [persistStorage]
  );

  return {
    views: storage?.views ?? [],
    activeViewId: storage?.activeViewId ?? null,
    activeView,
    autosave: storage?.autosave ?? false,
    hasLoaded,
    isDirty,
    storage,
    switchView,
    saveView,
    saveAsNewView,
    revertChanges,
    toggleAutosave,
    addViewFromCurrent,
    renameView,
    deleteView,
    importViews,
  };
}
