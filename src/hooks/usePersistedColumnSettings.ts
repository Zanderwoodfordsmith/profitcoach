"use client";

import { useCallback, useEffect, useState } from "react";

export type DataTableColumnOption<TKey extends string> = {
  key: TKey;
  label: string;
};

export type PersistedColumnSettings<TKey extends string> = {
  columnVisibility: Record<TKey, boolean>;
  columnOrder: TKey[];
};

export function parsePersistedColumnSettings<TKey extends string>(
  raw: string,
  options: {
    validKeys: readonly TKey[];
    defaultVisibility: Record<TKey, boolean>;
    defaultOrder: readonly TKey[];
    legacyKeyMap?: Record<string, TKey>;
  }
): PersistedColumnSettings<TKey> | null {
  try {
    const parsed = JSON.parse(raw) as Partial<{
      columnVisibility: Record<string, boolean>;
      columnOrder: string[];
    }>;
    if (!parsed.columnVisibility || !parsed.columnOrder) return null;

    const validKeys = new Set<TKey>(options.validKeys);
    const legacyKeyMap = options.legacyKeyMap ?? {};
    const columnVisibility = { ...options.defaultVisibility };

    for (const [rawKey, value] of Object.entries(parsed.columnVisibility)) {
      const key = validKeys.has(rawKey as TKey)
        ? (rawKey as TKey)
        : legacyKeyMap[rawKey];
      if (key && typeof value === "boolean") {
        columnVisibility[key] = value;
      }
    }

    const seen = new Set<TKey>();
    const columnOrder: TKey[] = [];
    for (const rawKey of parsed.columnOrder) {
      const key = validKeys.has(rawKey as TKey)
        ? (rawKey as TKey)
        : legacyKeyMap[rawKey];
      if (key && validKeys.has(key) && !seen.has(key)) {
        columnOrder.push(key);
        seen.add(key);
      }
    }
    for (const key of options.defaultOrder) {
      if (!seen.has(key)) columnOrder.push(key);
    }

    return { columnVisibility, columnOrder };
  } catch {
    return null;
  }
}

export function partitionOrderedColumns<TKey extends string>(
  columnOrder: readonly TKey[],
  columnVisibility: Record<TKey, boolean>,
  options: readonly DataTableColumnOption<TKey>[]
): {
  shown: DataTableColumnOption<TKey>[];
  hidden: DataTableColumnOption<TKey>[];
} {
  const byKey = new Map(options.map((option) => [option.key, option]));
  const applicable = new Set(options.map((option) => option.key));
  const shown: DataTableColumnOption<TKey>[] = [];
  const hidden: DataTableColumnOption<TKey>[] = [];

  for (const key of columnOrder) {
    if (!applicable.has(key)) continue;
    const option = byKey.get(key);
    if (!option) continue;
    if (columnVisibility[key]) shown.push(option);
    else hidden.push(option);
  }

  return { shown, hidden };
}

export function moveKeyInOrder<TKey extends string>(
  order: readonly TKey[],
  draggedKey: TKey,
  targetKey: TKey
): TKey[] {
  if (draggedKey === targetKey) return [...order];
  const from = order.indexOf(draggedKey);
  const to = order.indexOf(targetKey);
  if (from < 0 || to < 0) return [...order];
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

type UsePersistedColumnSettingsArgs<TKey extends string> = {
  storageKey: string;
  defaultVisibility: Record<TKey, boolean>;
  defaultOrder: readonly TKey[];
  validKeys: readonly TKey[];
  legacyKeyMap?: Record<string, TKey>;
};

export function usePersistedColumnSettings<TKey extends string>({
  storageKey,
  defaultVisibility,
  defaultOrder,
  validKeys,
  legacyKeyMap,
}: UsePersistedColumnSettingsArgs<TKey>) {
  const [columnVisibility, setColumnVisibility] =
    useState<Record<TKey, boolean>>(defaultVisibility);
  const [columnOrder, setColumnOrder] = useState<TKey[]>([...defaultOrder]);
  const [hasLoadedPersistedSettings, setHasLoadedPersistedSettings] =
    useState(false);

  // Defaults/keys are expected to be stable module-level constants; only
  // re-load when the storage key changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasLoadedPersistedSettings(false);
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = parsePersistedColumnSettings(raw, {
        validKeys,
        defaultVisibility,
        defaultOrder,
        legacyKeyMap,
      });
      if (parsed) {
        setColumnVisibility(parsed.columnVisibility);
        setColumnOrder(parsed.columnOrder);
      } else {
        setColumnVisibility(defaultVisibility);
        setColumnOrder([...defaultOrder]);
      }
    } else {
      setColumnVisibility(defaultVisibility);
      setColumnOrder([...defaultOrder]);
    }
    setHasLoadedPersistedSettings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable module constants
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedPersistedSettings || typeof window === "undefined") return;
    const payload: PersistedColumnSettings<TKey> = {
      columnVisibility,
      columnOrder,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    hasLoadedPersistedSettings,
    storageKey,
    columnVisibility,
    columnOrder,
  ]);

  const moveColumnInOrder = useCallback(
    (draggedKey: TKey, targetKey: TKey) => {
      setColumnOrder((prev) => moveKeyInOrder(prev, draggedKey, targetKey));
    },
    []
  );

  const setColumnVisible = useCallback((key: TKey, visible: boolean) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [key]: visible,
    }));
  }, []);

  return {
    columnVisibility,
    setColumnVisibility,
    setColumnVisible,
    columnOrder,
    setColumnOrder,
    moveColumnInOrder,
    hasLoadedPersistedSettings,
  };
}
