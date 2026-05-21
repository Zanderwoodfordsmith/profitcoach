"use client";

import {
  ActionPlanInvitationCard,
  type ActionPlanInvitationSummary,
} from "@/components/actionPlans/ActionPlanInvitationCard";
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
import { usePathname, useSearchParams } from "next/navigation";

export function MyActionsTab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const planToken = searchParams.get("plan");
  const { impersonatingCoachId } = useImpersonation();
  const storageKey = useMemo(
    () =>
      pathname.startsWith("/admin")
        ? "compass-my-actions-admin"
        : "compass-my-actions-coach",
    [pathname],
  );

  const [items, setItems] = useState<ActionOutlineLine[]>([]);
  const [invitations, setInvitations] = useState<ActionPlanInvitationSummary[]>([]);
  const [previewByInvitationId, setPreviewByInvitationId] = useState<
    Record<string, ActionOutlineLine[]>
  >({});
  const [expandedInvitationId, setExpandedInvitationId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledPlanTokenRef = useRef<string | null>(null);

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

  const loadInvitations = useCallback(async (headers: Record<string, string>) => {
    const res = await fetch("/api/coach/action-plan-invitations", { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { invitations?: ActionPlanInvitationSummary[] };
    return data.invitations ?? [];
  }, []);

  const loadPreview = useCallback(
    async (invitationId: string, headers: Record<string, string>) => {
      if (previewByInvitationId[invitationId]) return;
      setPreviewLoadingId(invitationId);
      try {
        const res = await fetch(`/api/coach/action-plan-invitations/${invitationId}`, {
          headers,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { previewItems?: ActionOutlineLine[] };
        setPreviewByInvitationId((prev) => ({
          ...prev,
          [invitationId]: data.previewItems ?? [],
        }));
      } finally {
        setPreviewLoadingId(null);
      }
    },
    [previewByInvitationId],
  );

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

      const [itemsRes, pendingInvitations] = await Promise.all([
        fetch("/api/coach/action-items", { headers }),
        loadInvitations(headers),
      ]);

      if (!itemsRes.ok) {
        const body = (await itemsRes.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to load actions.");
      }
      const data = (await itemsRes.json()) as { items?: ActionOutlineLine[] };
      let nextItems = data.items ?? [];

      if (!nextItems.length) {
        const migrated = await migrateLocalStorage(headers);
        if (migrated?.length) {
          nextItems = migrated;
        } else {
          nextItems = [createOutlineLine("", 0)];
        }
      }

      setInvitations(pendingInvitations);
      skipSaveRef.current = true;
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load actions.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, loadInvitations, migrateLocalStorage]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!planToken || handledPlanTokenRef.current === planToken) return;
    handledPlanTokenRef.current = planToken;

    async function openFromLink() {
      const headers = await authHeaders();
      if (!headers) return;
      try {
        const res = await fetch("/api/coach/action-plan-invitations", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: planToken }),
        });
        const data = (await res.json()) as {
          error?: string;
          invitation?: ActionPlanInvitationSummary;
          previewItems?: ActionOutlineLine[];
        };
        if (!res.ok) {
          setError(data.error ?? "Could not open action plan link.");
          return;
        }
        if (data.invitation) {
          setInvitations((prev) => {
            if (prev.some((row) => row.id === data.invitation!.id)) return prev;
            return [data.invitation!, ...prev];
          });
          setExpandedInvitationId(data.invitation.id);
          if (data.previewItems) {
            setPreviewByInvitationId((prev) => ({
              ...prev,
              [data.invitation!.id]: data.previewItems!,
            }));
          }
        }
      } catch {
        setError("Could not open action plan link.");
      }
    }
    void openFromLink();
  }, [authHeaders, planToken]);

  useEffect(() => {
    if (!expandedInvitationId) return;
    void authHeaders().then((headers) => {
      if (headers) void loadPreview(expandedInvitationId, headers);
    });
  }, [authHeaders, expandedInvitationId, loadPreview]);

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

  const handleAccept = async (invitationId: string) => {
    const headers = await authHeaders();
    if (!headers) return;
    setInviteBusyId(invitationId);
    setError(null);
    try {
      const res = await fetch(`/api/coach/action-plan-invitations/${invitationId}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "accept" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not accept plan.");
      setInvitations((prev) => prev.filter((row) => row.id !== invitationId));
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept plan.");
    } finally {
      setInviteBusyId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    const headers = await authHeaders();
    if (!headers) return;
    setInviteBusyId(invitationId);
    setError(null);
    try {
      const res = await fetch(`/api/coach/action-plan-invitations/${invitationId}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "decline" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not decline plan.");
      setInvitations((prev) => prev.filter((row) => row.id !== invitationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline plan.");
    } finally {
      setInviteBusyId(null);
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
      {invitations.map((invitation) => (
        <ActionPlanInvitationCard
          key={invitation.id}
          invitation={invitation}
          previewItems={previewByInvitationId[invitation.id]}
          previewLoading={previewLoadingId === invitation.id}
          expanded={expandedInvitationId === invitation.id}
          onToggleExpand={() =>
            setExpandedInvitationId((current) =>
              current === invitation.id ? null : invitation.id,
            )
          }
          onAccept={handleAccept}
          onDecline={handleDecline}
          busy={inviteBusyId === invitation.id}
        />
      ))}
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
