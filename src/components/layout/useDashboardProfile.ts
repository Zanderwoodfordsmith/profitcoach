"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHubQuery, peekHubQuery } from "@/lib/getClients/hubQueryCache";
import { getSessionUser } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { displayNameFromProfile } from "@/lib/communityProfile";

export type DashboardProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

export function useDashboardProfile(avatarOverride?: {
  name: string;
  avatarUrl: string | null;
} | null) {
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadProfile = useCallback(async (force = false) => {
    const user = await getSessionUser();
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    // Sidebar, top bar and menus all ask at once, on every page: paint the
    // last answer immediately and share one refresh between them.
    const key = `viewer-profile:${user.id}`;
    const cached = peekHubQuery<DashboardProfile | null>(key);
    if (cached !== undefined) {
      setProfile(cached);
      setProfileLoading(false);
    } else {
      setProfileLoading(true);
    }
    try {
      const data = await fetchHubQuery(
        key,
        async () => {
          const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, role, full_name, first_name, last_name, avatar_url, created_at")
            .eq("id", user.id)
            .maybeSingle();
          if (error) throw error;
          return (data as DashboardProfile | null) ?? null;
        },
        { staleMs: 5_000, force }
      );
      setProfile(data);
    } catch {
      if (cached === undefined) setProfile(null);
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await loadProfile();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const reloadProfile = useCallback(() => loadProfile(true), [loadProfile]);

  const avatarLabel = useMemo(() => {
    if (avatarOverride?.name) return avatarOverride.name;
    if (!profile) return "Account";
    return displayNameFromProfile(profile);
  }, [avatarOverride?.name, profile]);

  const avatarImageUrl = avatarOverride?.avatarUrl ?? profile?.avatar_url ?? null;

  return {
    profile,
    profileLoading,
    avatarLabel,
    avatarImageUrl,
    reloadProfile,
  };
}
