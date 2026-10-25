"use client";

import {
  displayNameFromProfile,
  profileInitialsFromName,
} from "@/lib/communityProfile";
import type { ProfileRow } from "@/components/community/CommunityFeed";
import { CommunityProfileHoverCard } from "@/components/community/CommunityProfileHoverCard";
import { OnlineDot } from "@/components/presence/OnlineDot";

type Props = {
  profile: ProfileRow | null;
  /** Default matches feed / detail header. */
  size?: "sm" | "md";
};

export function CommunityAuthorAvatar({ profile, size = "md" }: Props) {
  const name = profile ? displayNameFromProfile(profile) : "Member";
  const initials = profileInitialsFromName(name);
  const isAdmin = profile?.role === "admin";

  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const textSm = size === "sm" ? "text-xs" : "text-sm";

  const avatar = (
    <div className={`relative shrink-0 ${box}`}>
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className={`${box} rounded-full object-cover ring-2 ring-white ${
            isAdmin ? "shadow-[0_0_0_3px_rgb(2_132_199)]" : "shadow-[0_0_0_1px_rgb(226_232_240)]"
          }`}
        />
      ) : (
        <span
          className={`flex ${box} items-center justify-center rounded-full bg-slate-200 ${textSm} font-medium text-slate-600 ring-2 ring-white ${
            isAdmin ? "shadow-[0_0_0_3px_rgb(2_132_199)]" : "shadow-[0_0_0_1px_rgb(226_232_240)]"
          }`}
        >
          {initials}
        </span>
      )}
      {/* No ladder number on photos: coaches no longer know what it means (24 Oct 2026). */}
      <OnlineDot
        userId={profile?.id}
        className={size === "sm" ? "-bottom-0.5 -right-0.5 h-2.5 w-2.5" : "-bottom-0.5 -right-0.5 h-3 w-3"}
      />
    </div>
  );

  if (!profile?.id) return avatar;

  return (
    <CommunityProfileHoverCard
      userId={profile.id}
      profile={{
        id: profile.id,
        full_name: profile.full_name ?? null,
        first_name: profile.first_name ?? null,
        last_name: profile.last_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        role: profile.role ?? null,
      }}
    >
      {avatar}
    </CommunityProfileHoverCard>
  );
}
