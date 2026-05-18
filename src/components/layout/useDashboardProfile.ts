"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { displayNameFromProfile } from "@/lib/communityProfile";

export type DashboardProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export function useDashboardProfile(avatarOverride?: {
  name: string;
  avatarUrl: string | null;
} | null) {
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const { data } = await supabaseClient
      .from("profiles")
      .select("id, role, full_name, first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setProfile((data as DashboardProfile | null) ?? null);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
    reloadProfile: loadProfile,
  };
}
