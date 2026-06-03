"use client";

import { isCommunityOnline } from "@/lib/communityPresence";
import { CommunityProfileHoverCard } from "@/components/community/CommunityProfileHoverCard";

export type CommunityMemberHoverProfile = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  bio?: string | null;
  linkedin_url?: string | null;
  coach_business_name?: string | null;
  slug?: string | null;
};

export function formatCommunityLastSeenBrief(
  lastSeenAt: string | undefined,
  nowMs: number
): string {
  if (!lastSeenAt) return "Recently active";
  const diffMs = Math.max(0, nowMs - new Date(lastSeenAt).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Active now";
  if (mins < 60) return `Seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Seen ${days}d ago`;
}

export function communityMemberStatusLabel(
  lastSeenAt: string | undefined,
  clock: number
): string {
  if (isCommunityOnline(lastSeenAt, clock)) return "Online now";
  return formatCommunityLastSeenBrief(lastSeenAt, clock);
}

export function CommunityMemberProfileHoverTrigger({
  member,
  statusLabel,
  children,
}: {
  member: CommunityMemberHoverProfile;
  statusLabel?: string | null;
  children: React.ReactNode;
}) {
  return (
    <CommunityProfileHoverCard
      userId={member.id}
      statusLabel={statusLabel}
      profile={{
        id: member.id,
        full_name: member.full_name,
        first_name: member.first_name,
        last_name: member.last_name,
        avatar_url: member.avatar_url,
        role: member.role,
        bio: member.bio,
        linkedin_url: member.linkedin_url,
        coach_business_name: member.coach_business_name,
        slug: member.slug,
      }}
    >
      {children}
    </CommunityProfileHoverCard>
  );
}
