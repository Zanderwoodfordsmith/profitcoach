"use client";

import { displayNameFromProfile } from "@/lib/communityProfile";
import type { ProfileRow } from "@/components/community/CommunityFeed";
import { getLadderLevel } from "@/lib/ladder";

type Props = {
  profile: ProfileRow | null;
  /** Default matches feed / detail header. */
  size?: "sm" | "md";
};

export function CommunityAuthorAvatar({ profile, size = "md" }: Props) {
  const name = profile ? displayNameFromProfile(profile) : "Member";
  const lvl = profile?.ladder_level
    ? getLadderLevel(profile.ladder_level)
    : null;
  const showBadge = Boolean(lvl && lvl.ordinal > 0);

  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const textSm = size === "sm" ? "text-xs" : "text-sm";
  const badge =
    size === "sm"
      ? "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold tabular-nums shadow-sm ring-[1.5px] ring-white"
      : "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold tabular-nums shadow-sm ring-[1.5px] ring-white";

  return (
    <div className={`relative shrink-0 ${box}`}>
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className={`${box} rounded-full object-cover ring-1 ring-slate-100`}
        />
      ) : (
        <span
          className={`flex ${box} items-center justify-center rounded-full bg-slate-200 ${textSm} font-medium text-slate-600`}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {showBadge && lvl ? (
        <span
          className={`${badge} ${lvl.chipClassName}`}
          title={lvl.name}
        >
          {lvl.ordinal}
        </span>
      ) : null}
    </div>
  );
}
