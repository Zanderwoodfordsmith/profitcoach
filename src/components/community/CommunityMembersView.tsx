"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, MapPin, User } from "lucide-react";

import {
  COMMUNITY_ONLINE_WINDOW_MS,
  isCommunityOnline,
} from "@/lib/communityPresence";
import { CommunitySidebar } from "@/components/community/CommunitySidebar";
import {
  useCommunityMemberDirectory,
  type CommunityMembersFilter,
  type CommunityRosterMember,
} from "@/components/community/useCommunityMemberDirectory";

function displayName(m: CommunityRosterMember): string {
  const n =
    m.full_name?.trim() ||
    [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
    m.coach_business_name?.trim();
  return n || "Member";
}

function formatJoined(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLastSeen(
  iso: string | null | undefined,
  nowMs: number
): string {
  if (!iso) return "Unknown";
  const diff = nowMs - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function parseFilter(raw: string | null): CommunityMembersFilter {
  if (raw === "online" || raw === "admins") return raw;
  return "members";
}

export function CommunityMembersView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = pathname.startsWith("/admin")
    ? "/admin/community"
    : "/coach/community";

  const filter = useMemo(
    () => parseFilter(searchParams.get("filter")),
    [searchParams]
  );

  const {
    roster,
    lastSeenByUserId,
    presenceUnavailable,
    loadError,
    clock,
    counts,
  } = useCommunityMemberDirectory();

  const filtered = useMemo(() => {
    let list = [...roster];
    if (filter === "admins") list = list.filter((m) => m.role === "admin");
    if (filter === "online")
      list = list.filter((m) =>
        isCommunityOnline(lastSeenByUserId[m.id], clock)
      );
    list.sort((a, b) =>
      displayName(a).localeCompare(displayName(b), undefined, {
        sensitivity: "base",
      })
    );
    return list;
  }, [roster, filter, lastSeenByUserId, clock]);

  const pillHref = (id: CommunityMembersFilter) =>
    id === "members" ? `${base}/members` : `${base}/members?filter=${id}`;

  const pillClass = (id: CommunityMembersFilter) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      filter === id
        ? "bg-sky-700 text-white"
        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  const countClass = (id: CommunityMembersFilter) =>
    filter === id ? "text-sky-200" : "text-slate-500";

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="mx-auto w-full max-w-3xl min-w-0 flex-1 pt-2">
      <h1 className="text-lg font-semibold text-slate-900">
        Community members
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Coaches and staff on Profit Coach.{" "}
        {presenceUnavailable ? (
          <span className="text-slate-500">
            Online status appears after the presence migration is applied.
          </span>
        ) : (
          <>
            Online means active in the community within{" "}
            {Math.round(COMMUNITY_ONLINE_WINDOW_MS / 60000)} minutes.
          </>
        )}
      </p>

      {loadError ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {loadError}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={pillHref("members")} className={pillClass("members")}>
          Members{" "}
          <span className={countClass("members")}>{counts.members}</span>
        </Link>
        <Link href={pillHref("online")} className={pillClass("online")}>
          Online{" "}
          <span className={countClass("online")}>{counts.online}</span>
        </Link>
        <Link href={pillHref("admins")} className={pillClass("admins")}>
          Admins{" "}
          <span className={countClass("admins")}>{counts.admins}</span>
        </Link>
      </div>

      <ul className="mt-6 space-y-2">
        {filtered.map((m) => {
          const name = displayName(m);
          const sub =
            m.coach_business_name?.trim() &&
            m.coach_business_name.trim() !== name
              ? m.coach_business_name.trim()
              : null;
          const online = isCommunityOnline(lastSeenByUserId[m.id], clock);
          const profileHref =
            m.directory_listed && m.slug ? `/directory/${m.slug}` : null;
          const roleLabel = m.role === "admin" ? "Admin" : "Coach";
          const joined = formatJoined(m.created_at);

          return (
            <li
              key={m.id}
              className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
            >
              <div className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200 text-slate-400">
                      <User className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                  )}
                  {online ? (
                    <span
                      className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"
                      title="Online now"
                      aria-label="Online now"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="truncate font-semibold text-slate-900">
                      {name}
                    </p>
                    <span className="text-xs font-medium text-sky-600">
                      {roleLabel}
                    </span>
                  </div>
                  {m.slug ? (
                    <p className="truncate text-xs text-slate-500">@{m.slug}</p>
                  ) : null}
                  {sub ? (
                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {sub}
                    </p>
                  ) : null}
                  {m.bio ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {m.bio}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span
                      className={
                        online ? "font-medium text-emerald-700" : undefined
                      }
                    >
                      {online
                        ? "Active now"
                        : `Last seen ${formatLastSeen(lastSeenByUserId[m.id], clock)}`}
                    </span>
                    {joined ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        Joined {joined}
                      </span>
                    ) : null}
                    {m.location ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{m.location}</span>
                      </span>
                    ) : null}
                  </div>
                  {profileHref ? (
                    <Link
                      href={profileHref}
                      className="mt-3 inline-flex rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      View profile
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!loadError && filtered.length === 0 ? (
        <p className="mt-8 py-6 text-center text-sm text-slate-500">
          No one in this list yet.
        </p>
      ) : null}
      </div>
      <CommunitySidebar />
    </div>
  );
}
