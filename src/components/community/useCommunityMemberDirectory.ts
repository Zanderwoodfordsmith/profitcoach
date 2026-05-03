"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { isCommunityOnline } from "@/lib/communityPresence";

export type CommunityRosterMember = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  role: string;
  created_at: string | null;
  slug: string | null;
  directory_listed: boolean;
};

export type CommunityMembersFilter = "members" | "online" | "admins";

type PresenceRow = { user_id: string; last_seen_at: string };

type StaffProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  role: string;
  created_at: string | null;
};

function mergeRoster(
  profiles: StaffProfileRow[],
  coaches: Array<{
    id: string;
    slug: string | null;
    directory_listed: boolean | null;
  }>
): CommunityRosterMember[] {
  const coachById = new Map(coaches.map((c) => [c.id, c]));
  return profiles.map((p) => {
    const c = coachById.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      first_name: p.first_name,
      last_name: p.last_name,
      coach_business_name: p.coach_business_name,
      avatar_url: p.avatar_url,
      bio: p.bio,
      location: p.location,
      role: p.role,
      created_at: p.created_at,
      slug: c?.slug ?? null,
      directory_listed: !!c?.directory_listed,
    };
  });
}

function displayNameShort(m: CommunityRosterMember): string {
  const n =
    m.full_name?.trim() ||
    [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
    m.coach_business_name?.trim();
  return n || "Member";
}

type CommunityMemberDirectoryValue = ReturnType<
  typeof useCommunityMemberDirectoryState
>;

const CommunityMemberDirectoryContext =
  createContext<CommunityMemberDirectoryValue | null>(null);

export function CommunityMemberDirectoryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useCommunityMemberDirectoryState();
  return createElement(
    CommunityMemberDirectoryContext.Provider,
    { value },
    children
  );
}

export function useCommunityMemberDirectory(): CommunityMemberDirectoryValue {
  const ctx = useContext(CommunityMemberDirectoryContext);
  if (!ctx) {
    throw new Error(
      "useCommunityMemberDirectory must be used within CommunityMemberDirectoryProvider"
    );
  }
  return ctx;
}

function useCommunityMemberDirectoryState() {
  const [roster, setRoster] = useState<CommunityRosterMember[]>([]);
  const [presenceRows, setPresenceRows] = useState<PresenceRow[]>([]);
  const [presenceUnavailable, setPresenceUnavailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const lastSeenByUserId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of presenceRows) {
      m[r.user_id] = r.last_seen_at;
    }
    return m;
  }, [presenceRows]);

  const loadRoster = useCallback(async () => {
    const { data: profiles, error: pErr } = await supabaseClient
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, coach_business_name, avatar_url, bio, location, role, created_at"
      )
      .in("role", ["coach", "admin"]);

    if (pErr) throw pErr;
    const plist = profiles ?? [];
    const ids = plist.map((p) => p.id);

    let coaches: Array<{
      id: string;
      slug: string | null;
      directory_listed: boolean | null;
    }> = [];
    if (ids.length > 0) {
      const { data: coachData, error: cErr } = await supabaseClient
        .from("coaches")
        .select("id, slug, directory_listed")
        .in("id", ids);
      if (!cErr && coachData) coaches = coachData as typeof coaches;
    }

    setRoster(
      mergeRoster(plist as StaffProfileRow[], coaches).sort((a, b) =>
        displayNameShort(a).localeCompare(displayNameShort(b), undefined, {
          sensitivity: "base",
        })
      )
    );
  }, []);

  const loadPresence = useCallback(async () => {
    if (presenceUnavailable) return;
    const { data, error } = await supabaseClient
      .from("community_presence")
      .select("user_id, last_seen_at");

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (
        msg.includes("community_presence") &&
        (msg.includes("does not exist") ||
          msg.includes("schema cache") ||
          msg.includes("not find"))
      ) {
        setPresenceUnavailable(true);
        setPresenceRows([]);
        return;
      }
      throw error;
    }
    setPresenceRows((data ?? []) as PresenceRow[]);
  }, [presenceUnavailable]);

  const touchPresence = useCallback(async () => {
    if (presenceUnavailable) return;
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { error } = await supabaseClient.from("community_presence").upsert(
      { user_id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (
        msg.includes("community_presence") &&
        (msg.includes("does not exist") ||
          msg.includes("schema cache") ||
          msg.includes("not find"))
      ) {
        setPresenceUnavailable(true);
      }
    }
  }, [presenceUnavailable]);

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      await Promise.all([loadRoster(), loadPresence()]);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load community members."
      );
    }
  }, [loadPresence, loadRoster]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) await touchPresence();
      if (!cancelled) await loadPresence();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPresence, refresh, touchPresence]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void (async () => {
        await touchPresence();
        await loadPresence();
      })();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loadPresence, touchPresence]);

  const counts = useMemo(() => {
    const members = roster.length;
    const admins = roster.filter((r) => r.role === "admin").length;
    const online = roster.filter((r) =>
      isCommunityOnline(lastSeenByUserId[r.id], clock)
    ).length;
    return { members, admins, online };
  }, [roster, lastSeenByUserId, clock]);

  return {
    roster,
    lastSeenByUserId,
    presenceUnavailable,
    loadError,
    clock,
    refresh,
    counts,
  };
}
