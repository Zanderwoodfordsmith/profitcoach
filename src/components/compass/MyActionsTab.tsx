"use client";

import { ActionOutlineEditor } from "@/components/actionPlans/ActionOutlineEditor";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  createOutlineLine,
  normalizeLegacyStorageLines,
} from "@/lib/actionPlans/actionOutlineUtils";
import type { ActionOutlineLine } from "@/lib/actionPlans/types";
import { supabaseClient } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function MyActionsTab() {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const storageKey = useMemo(
    () =>
      pathname.startsWith("/admin")
        ? "compass-my-actions-admin"
        : "compass-my-actions-coach",
    [pathname],
  );

  const [items, setItems] = useState<ActionOutlineLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [impersonatingCoachId]);

  const migrateLocalStorage = useCallback(
    async (headers: Record<string, string>) => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        const lines = normalizeLegacyStorageLines(parsed);
        if (!lines?.length) return null;

        const res = await fetch("/api/coach/action-items/migrate-local", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lines, raw: parsed }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          migrated?: boolean;
          items?: ActionOutlineLine[];
        };
        if (data.migrated) {
          window.localStorage.removeItem(storageKey);
        }
        return data.items ?? null;
      } catch {
        return null;
      }
    },
    [storageKey],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Please sign in again.");
        setLoading(false);
        return;
      }

      let res = await fetch("/api/coach/action-items", { headers });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to load actions.");
      }
      let data = (await res.json()) as { items?: ActionOutlineLine[] };
      let nextItems = data.items ?? [];

      if (!nextItems.length) {
        const migrated = await migrateLocalStorage(headers);
        if (migrated?.length) {
          nextItems = migrated;
        } else {
          nextItems = [createOutlineLine("", 0)];
        }
      }

      skipSaveRef.current = true;
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load actions.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, migrateLocalStorage]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const persistItems = useCallback(
    async (nextItems: ActionOutlineLine[]) => {
      const headers = await authHeaders();
      if (!headers) return;
      setSaving(true);
      try {
        const res = await fetch("/api/coach/action-items", {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items: nextItems }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to save actions.");
        }
        const data = (await res.json()) as { items?: ActionOutlineLine[] };
        if (data.items) {
          skipSaveRef.current = true;
          setItems(data.items);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save actions.");
      } finally {
        setSaving(false);
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    if (loading || skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistItems(items);
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [items, loading, persistItems]);

  const handleToggleDone = async (index: number, item: ActionOutlineLine) => {
    const headers = await authHeaders();
    if (!headers) return;

    const nextDone = !item.done;
    setItems((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              done: nextDone,
              doneSource: nextDone ? "manual" : null,
            }
          : line,
      ),
    );

    try {
      const res = await fetch(`/api/coach/action-items/${item.id}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ done: nextDone }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to update action.");
      }
      const data = (await res.json()) as { item?: ActionOutlineLine };
      if (data.item) {
        skipSaveRef.current = true;
        setItems((prev) =>
          prev.map((line) => (line.id === data.item!.id ? data.item! : line)),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update action.");
      void loadItems();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading actions…
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <div className="mx-auto mb-4 max-w-5xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {saving ? (
        <div className="mx-auto mb-2 max-w-5xl px-4 text-xs text-slate-500">Saving…</div>
      ) : null}
      <ActionOutlineEditor
        items={items}
        onItemsChange={setItems}
        mode="coach"
        isRowLocked={(_index, item) => Boolean(item.isLocked)}
        onToggleDone={handleToggleDone}
        loading={saving}
      />
    </div>
  );
}
