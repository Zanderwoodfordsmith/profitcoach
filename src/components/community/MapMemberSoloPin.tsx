"use client";

import { profileInitialsFromName } from "@/lib/communityProfile";

import type { MapMember } from "./CommunityMembersMap";

const PIN_TAIL_PATH =
  "M16 0a14 14 0 0 0-14 14c0 9.9 13.1 24.6 13.7 25.2a.7.7 0 0 0 .6 0C16.9 38.6 30 23.9 30 14A14 14 0 0 0 16 0z";

function memberDisplayName(member: MapMember): string {
  return (
    member.full_name?.trim() ||
    member.coach_business_name?.trim() ||
    "Coach"
  );
}

function MapSoloPinSvg({ member }: { member: MapMember }) {
  const clipId = `pin-head-${member.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const initials = profileInitialsFromName(memberDisplayName(member));

  return (
    <svg
      viewBox="0 0 32 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="block h-10 w-8"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="14" r="14" />
        </clipPath>
      </defs>
      <path d={PIN_TAIL_PATH} fill="#0c5290" />
      <g clipPath={`url(#${clipId})`}>
        {member.avatar_url ? (
          <image
            href={member.avatar_url}
            x="0"
            y="-2"
            width="32"
            height="32"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <>
            <circle cx="16" cy="14" r="14" fill="#e2e8f0" />
            <text
              x="16"
              y="15"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="system-ui, sans-serif"
              fontSize="9"
              fontWeight="700"
              fill="#475569"
            >
              {initials}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

export function MapMemberSoloPin({ member }: { member: MapMember }) {
  const name = memberDisplayName(member);

  return (
    <div className="pc-map-pin-solo">
      <div className="pc-map-pin-solo__pin">
        <MapSoloPinSvg member={member} />
      </div>
      <div className="pc-map-pin-solo__label" title={name}>
        {name}
      </div>
    </div>
  );
}
