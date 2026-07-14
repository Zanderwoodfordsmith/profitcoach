"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { copyCoachLandingLinkOnInvite } from "@/lib/buildCoachLandingLink";
import { chunkArray } from "@/lib/chunkArray";
import { mergeCoachFilterOptions } from "@/lib/mergeCoachFilterOptions";
import { useStickyPageHeaderOffset } from "@/hooks/useStickyPageHeaderOffset";
import type { ProspectRow } from "@/lib/prospectRow";
import { applyProspectPatch } from "@/lib/prospects/applyProspectPatch";
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

  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [coaches, setCoaches] = useState<CoachListRow[]>([]);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [effectiveCoachId, setEffectiveCoachId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [scoresEnriching, setScoresEnriching] = useState(false);
  const [prospectListVersion, setProspectListVersion] = useState(0);

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
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
        error?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        if (scope === "coach") {
          router.replace("/login");
          return;
        }
        setError("Unable to load prospects.");
        setLoading(false);
        return;
      }

      if (scope === "admin") {
        if (roleBody.role !== "admin") {
          router.replace("/coach");
          return;
        }
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [contactsRes, coachesRes] = await Promise.all([
          fetch("/api/admin/contacts?type=prospect", { headers }),
          fetch("/api/admin/coaches", { headers }),
        ]);
        if (cancelled) return;
        if (!contactsRes.ok) {
          const body = (await contactsRes.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body?.error ?? "Unable to load prospects.");
          setLoading(false);
          return;
        }
        const contactsBody = (await contactsRes.json()) as {
          prospects?: ProspectRow[];
        };
        enrichedIdsRef.current = new Set();
        enrichInFlightRef.current = new Set();
        setProspects(contactsBody.prospects ?? []);
        setProspectListVersion((version) => version + 1);
        if (coachesRes.ok) {
          const coachesBody = (await coachesRes.json()) as {
            coaches?: Array<{
              id: string;
              slug: string;
              full_name?: string | null;
              coach_business_name?: string | null;
            }>;
          };
          setCoaches(
            (coachesBody.coaches ?? []).map((c) => ({
              id: c.id,
              slug: c.slug,
              full_name: c.full_name ?? null,
              coach_business_name: c.coach_business_name ?? null,
            }))
          );
        }
        setLoading(false);
        return;
      }

      // coach scope
      const effectiveId =
        roleBody.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }
      setUserId(user.id);
      setEffectiveCoachId(effectiveId);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (roleBody.role === "admin" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      const res = await fetch("/api/coach/prospects", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        prospects?: ProspectRow[];
        coachSlug?: string | null;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Unable to load prospects.");
        setLoading(false);
        return;
      }
      enrichedIdsRef.current = new Set();
      enrichInFlightRef.current = new Set();
      setProspects(body.prospects ?? []);
      setProspectListVersion((version) => version + 1);
      setCoachSlug(body.coachSlug ?? null);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, scope, impersonatingCoachId]);

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
    openAddProspect,
    closeAddProspect,
    enrichVisibleIds,
  };
}
