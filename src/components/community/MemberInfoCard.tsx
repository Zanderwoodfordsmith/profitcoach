"use client";

import Link from "next/link";
import { User, MapPin } from "lucide-react";

import type { MapMember } from "./CommunityMembersMap";

export function MemberInfoCard({ member }: { member: MapMember }) {
  const displayName =
    member.full_name?.trim() ||
    member.coach_business_name?.trim() ||
    "Coach";
  const subline = member.coach_business_name?.trim() || null;
  const profileHref =
    member.directory_listed && member.slug
      ? `/directory/coach/${member.slug}`
      : null;

  return (
    <div className="flex w-full flex-col gap-3 p-3 text-slate-900">
      <div className="flex items-start gap-3">
        {member.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatar_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
            <User className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {displayName}
          </p>
          {subline && subline !== displayName ? (
            <p className="truncate text-xs text-slate-600">{subline}</p>
          ) : null}
          {member.location ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{member.location}</span>
            </p>
          ) : null}
        </div>
      </div>

      {member.bio ? (
        <p className="text-xs leading-relaxed text-slate-600">{member.bio}</p>
      ) : null}

      {profileHref ? (
        <Link
          href={profileHref}
          className="inline-flex items-center justify-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
        >
          View profile
        </Link>
      ) : null}
    </div>
  );
}
