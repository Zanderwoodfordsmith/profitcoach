"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { fetchHubQuery, peekHubQuery, writeHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";
import {
  loadProspectsHubPayload,
  type ProspectsHubPayload,
} from "@/lib/getClients/hubFetchers";
import { copyCoachLandingLinkOnInvite } from "@/lib/buildCoachLandingLink";
import { chunkArray } from "@/lib/chunkArray";
import { mergeCoachFilterOptions } from "@/lib/mergeCoachFilterOptions";
import { useStickyPageHeaderOffset } from "@/hooks/useStickyPageHeaderOffset";
import type { ProspectRow } from "@/lib/prospectRow";
import type { ProspectNextCall } from "@/lib/prospectNextCall";
import { applyProspectPatch } from "@/lib/prospects/applyProspectPatch";
import { resolveProspectStatus } from "@/lib/prospectStatus";
import type {
  ProspectFieldPatch,
  UpdatedProspectFields,
} from "@/lib/prospects/updateProspectFields";

/** Keep enrich querystrings short enough for browsers / proxies. */
const PROSPECT_ENRICH_CHUNK = 50;

type CoachListRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

type UseProspectsPageOptions = {
  scope: "admin" | "coach";
};

export function useProspectsPage({ scope }: UseProspectsPageOptions) {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const cacheKey = hubQueryKey(`prospects:${scope}`, impersonatingCoachId);
  const cached = peekHubQuery<ProspectsHubPayload>(cacheKey);

  const [prospects, setProspects] = useState<ProspectRow[]>(
    () => cached?.prospects ?? []
  );
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [creatingProspect, setCreatingProspect] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newCoachId, setNewCoachId] = useState<string | "">("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [sendInvite, setSendInvite] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<CoachListRow[]>(
    () => cached?.coaches ?? []
  );
  const [coachSlug, setCoachSlug] = useState<string | null>(
    () => cached?.coachSlug ?? null
  );
  const [effectiveCoachId, setEffectiveCoachId] = useState<string | null>(
    () => cached?.effectiveCoachId ?? null
  );
  const [userId, setUserId] = useState<string | null>(
    () => cached?.userId ?? null
  );
  const [scoresEnriching, setScoresEnriching] = useState(false);
  const [prospectListVersion, setProspectListVersion] = useState(() =>
    cached ? 1 : 0
  );

  const { pageHeaderRef, pageHeaderHeight } = useStickyPageHeaderOffset([
    loading,
    showAddProspect,
  ]);

  const enrichedIdsRef = useRef(new Set<string>());
  const enrichInFlightRef = useRef(new Set<string>());
  const enrichAllGenerationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const hit = peekHubQuery<ProspectsHubPayload>(cacheKey);
      if (hit) {
        setProspects(hit.prospects);
        setCoaches(hit.coaches);
        setCoachSlug(hit.coachSlug);
        setUserId(hit.userId);
        setEffectiveCoachId(hit.effectiveCoachId);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        if (scope === "admin") {
          const {
            data: { user },
          } = await supabaseClient.auth.getUser();
          if (!user) {
            router.replace("/login");
            return;
          }
          const { fetchCachedProfileRole } = await import(
            "@/lib/getClients/cachedProfileRole"
          );
          const roleBody = await fetchCachedProfileRole(user.id);
          if (roleBody.role !== "admin") {
            router.replace("/coach");
            return;
          }
        }

        const payload = await fetchHubQuery(cacheKey, () =>
          loadProspectsHubPayload(scope)
        );
        if (cancelled) return;
        enrichedIdsRef.current = new Set();
        enrichInFlightRef.current = new Set();
        setProspects(payload.prospects);
        setCoaches(payload.coaches);
        setCoachSlug(payload.coachSlug);
        setUserId(payload.userId);
        setEffectiveCoachId(payload.effectiveCoachId);
        setProspectListVersion((version) => version + 1);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unable to load prospects.";
        if (message === "Sign in required.") {
          router.replace("/login");
          return;
        }
        if (!hit) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, router, scope]);

  useEffect(() => {
    if (loading) return;
    const current = peekHubQuery<ProspectsHubPayload>(cacheKey);
    if (!current) return;
    writeHubQuery(cacheKey, {
      ...current,
      prospects,
      coaches,
      coachSlug,
      userId: userId ?? current.userId,
      effectiveCoachId: effectiveCoachId ?? current.effectiveCoachId,
    });
  }, [
    cacheKey,
    coaches,
    coachSlug,
    effectiveCoachId,
    loading,
    prospects,
    userId,
  ]);

  const coachOptions = useMemo(
    () => mergeCoachFilterOptions(prospects, coaches),
    [prospects, coaches]
  );

  const coachSlugByCoachId = useMemo(
    () =>
      Object.fromEntries(
        coaches
          .map((coach) => [coach.id, coach.slug.trim()] as const)
          .filter(([, slug]) => slug.length > 0)
      ),
    [coaches]
  );

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const accessToken = await getValidSupabaseAccessToken();
    if (!accessToken) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (scope === "coach" && impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [scope, impersonatingCoachId]);

  const contactUrl = useCallback(
    (id?: string) => {
      if (scope === "admin") {
        return id ? `/api/admin/contacts/${id}` : "/api/admin/contacts";
      }
      return id ? `/api/coach/contacts/${id}` : "/api/coach/contacts";
    },
    [scope]
  );

  const handleDeleteProspect = useCallback(
    async (row: ProspectRow, options?: { skipConfirm?: boolean }) => {
      const headers = await authHeaders();
      if (!headers) {
        const message = "You must be signed in to delete a prospect.";
        setError(message);
        throw new Error(message);
      }
      if (!options?.skipConfirm) setDeletingId(row.id);
      try {
        const res = await fetch(contactUrl(row.id), {
          method: "DELETE",
          headers,
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? "Unable to delete prospect.");
        }
        setProspects((prev) => prev.filter((p) => p.id !== row.id));
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Unable to delete prospect."
        );
        throw err;
      } finally {
        if (!options?.skipConfirm) setDeletingId(null);
      }
    },
    [authHeaders, contactUrl]
  );

  const handleUpdateProspect = useCallback(
    async (row: ProspectRow, patch: ProspectFieldPatch) => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("You must be signed in to update a prospect.");
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      };
      if (scope === "coach" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch(contactUrl(row.id), {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      const body = (await res.json().catch(() => ({}))) as UpdatedProspectFields & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to update prospect.");
      }
      setProspects((prev) =>
        prev.map((p) => (p.id === row.id ? applyProspectPatch(p, body) : p))
      );
    },
    [scope, impersonatingCoachId, contactUrl]
  );

  const handleProspectBooked = useCallback(
    (row: ProspectRow, nextCall: ProspectNextCall) => {
      setProspects((prev) =>
        prev.map((p) => {
          if (p.id !== row.id) return p;
          const prospect_status = "booked";
          return {
            ...p,
            prospect_status,
            next_call: nextCall,
            status: resolveProspectStatus({
              prospect_status,
              last_completed_at: p.last_assessed_at,
              next_call: nextCall,
              next_action: p.next_action,
            }),
          };
        })
      );
    },
    []
  );

  const handleCreateProspect = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError(null);
      setCreateSuccess(null);
      setCreatingProspect(true);

      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          throw new Error("You must be signed in to add a prospect.");
        }

        let url: string;
        const body: Record<string, unknown> = {
          fullName: newFullName,
          email: newEmail,
          businessName: newBusinessName,
          sendInvite,
        };

        if (scope === "admin") {
          if (!newCoachId) {
            throw new Error("Please select a coach for this prospect.");
          }
          url = "/api/admin/contacts";
          body.coachId = newCoachId;
        } else {
          const isRealCoach = effectiveCoachId === userId;
          url = isRealCoach ? "/api/coach/contacts" : "/api/admin/contacts";
          if (!isRealCoach && effectiveCoachId) {
            body.coachId = effectiveCoachId;
          }
        }

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error ?? "Unable to create prospect.");
        }

        const message = await copyCoachLandingLinkOnInvite({
          sendInvite,
          coachSlug: data?.coachSlug,
        });
        setCreateSuccess(message);

        setNewCoachId("");
        setNewFullName("");
        setNewEmail("");
        setNewBusinessName("");
        setSendInvite(false);
        router.refresh();
      } catch (err: unknown) {
        setCreateError(
          err instanceof Error ? err.message : "Unable to create prospect."
        );
      } finally {
        setCreatingProspect(false);
      }
    },
    [
      scope,
      newCoachId,
      newFullName,
      newEmail,
      newBusinessName,
      sendInvite,
      effectiveCoachId,
      userId,
      router,
    ]
  );

  const mergeImportedProspects = useCallback((rows: ProspectRow[]) => {
    if (rows.length === 0) return;
    setProspects((prev) => {
      const byId = new Map(prev.map((row) => [row.id, row]));
      const next = [...prev];
      for (const row of rows) {
        if (byId.has(row.id)) {
          const idx = next.findIndex((item) => item.id === row.id);
          if (idx >= 0) next[idx] = row;
        } else {
          next.unshift(row);
          byId.set(row.id, row);
        }
      }
      return next;
    });
  }, []);

  const openAddProspect = useCallback(() => {
    setShowAddProspect(true);
    setCreateError(null);
    setCreateSuccess(null);
  }, []);

  const closeAddProspect = useCallback(() => {
    setShowAddProspect(false);
    setCreateError(null);
    setCreateSuccess(null);
  }, []);

  const enrichIds = useCallback(
    async (ids: string[]) => {
      const needed = ids.filter(
        (id) =>
          !enrichedIdsRef.current.has(id) && !enrichInFlightRef.current.has(id)
      );
      if (needed.length === 0) return;

      for (const id of needed) enrichInFlightRef.current.add(id);

      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          for (const id of needed) enrichInFlightRef.current.delete(id);
          return;
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (scope === "coach" && impersonatingCoachId) {
          headers["x-impersonate-coach-id"] = impersonatingCoachId;
        }

        const qs = new URLSearchParams({
          enrichIds: needed.join(","),
        });
        const url =
          scope === "admin"
            ? `/api/admin/contacts?type=prospect&${qs}`
            : `/api/coach/prospects?${qs}`;

        const res = await fetch(url, { headers, cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          prospects?: ProspectRow[];
        };
        if (!res.ok || !body.prospects?.length) {
          for (const id of needed) enrichInFlightRef.current.delete(id);
          return;
        }

        const byId = new Map(body.prospects.map((row) => [row.id, row]));
        for (const id of needed) {
          enrichInFlightRef.current.delete(id);
          if (byId.has(id)) enrichedIdsRef.current.add(id);
        }

        setProspects((prev) =>
          prev.map((row) => byId.get(row.id) ?? row)
        );
      } catch {
        for (const id of needed) enrichInFlightRef.current.delete(id);
      }
    },
    [scope, impersonatingCoachId]
  );

  const enrichVisibleIds = useCallback(
    async (ids: string[]) => {
      await enrichIds(ids);
    },
    [enrichIds]
  );

  // Lite rows ship without scores. Enrich every prospect so Boss / Boss Pro
  // filters aren't stuck on whoever happened to be on the first page.
  useEffect(() => {
    if (loading || prospectListVersion === 0) {
      setScoresEnriching(false);
      return;
    }

    const generation = ++enrichAllGenerationRef.current;
    const ids = prospects.map((prospect) => prospect.id);
    const needed = ids.filter((id) => !enrichedIdsRef.current.has(id));
    if (needed.length === 0) {
      setScoresEnriching(false);
      return;
    }

    let cancelled = false;
    setScoresEnriching(true);

    void (async () => {
      for (const chunk of chunkArray(needed, PROSPECT_ENRICH_CHUNK)) {
        if (cancelled || enrichAllGenerationRef.current !== generation) return;
        await enrichIds(chunk);
      }
      if (!cancelled && enrichAllGenerationRef.current === generation) {
        setScoresEnriching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // prospects from the list-version render; do not re-run on each enrich merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prospectListVersion gates full reloads
  }, [loading, prospectListVersion, enrichIds]);

  return {
    prospects,
    loading,
    scoresEnriching,
    error,
    showAddProspect,
    creatingProspect,
    createError,
    createSuccess,
    newCoachId,
    setNewCoachId,
    newFullName,
    setNewFullName,
    newEmail,
    setNewEmail,
    newBusinessName,
    setNewBusinessName,
    sendInvite,
    setSendInvite,
    deletingId,
    coaches,
    coachSlug,
    coachSlugByCoachId,
    coachOptions,
    effectiveCoachId,
    pageHeaderRef,
    pageHeaderHeight,
    handleCreateProspect,
    handleDeleteProspect,
    handleUpdateProspect,
    handleProspectBooked,
    openAddProspect,
    closeAddProspect,
    enrichVisibleIds,
    mergeImportedProspects,
  };
}
