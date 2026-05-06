"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";

import { isCommunityOnline } from "@/lib/communityPresence";
import { ladderOrdinal } from "@/lib/ladder";
import { CommunitySidebar } from "@/components/community/CommunitySidebar";
import {
  useCommunityMemberDirectory,
  type CommunityMembersFilter,
  type CommunityRosterMember,
} from "@/components/community/useCommunityMemberDirectory";
import { paginationItems } from "@/lib/communityPagination";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { supabaseClient } from "@/lib/supabaseClient";

const MEMBERS_PER_PAGE = 20;

function displayName(m: CommunityRosterMember): string {
  const n =
    m.full_name?.trim() ||
    [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
    m.coach_business_name?.trim();
  return n || "Member";
}

function formatJoined(iso: string | null): string | null {
  if (!iso) return null;
  const t = iso.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t)
    ? new Date(`${t}T12:00:00Z`)
    : new Date(t);
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

type CommunityMembersSort = "last" | "name" | "level";

function defaultDirForSort(sort: CommunityMembersSort): "asc" | "desc" {
  if (sort === "name") return "asc";
  return "desc";
}

function parseSort(raw: string | null): CommunityMembersSort {
  if (raw === "name" || raw === "level") return raw;
  if (raw === "last" || raw === "recent") return "last";
  return "last";
}

function parseDir(
  raw: string | null,
  sort: CommunityMembersSort
): "asc" | "desc" {
  if (raw === "asc" || raw === "desc") return raw;
  return defaultDirForSort(sort);
}

function membersQuery(
  filter: CommunityMembersFilter,
  sort: CommunityMembersSort,
  dir: "asc" | "desc"
): string {
  const p = new URLSearchParams();
  if (filter !== "members") p.set("filter", filter);
  if (sort !== "last") p.set("sort", sort);
  if (dir !== defaultDirForSort(sort)) p.set("dir", dir);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const SORT_MENU_OPTIONS: ReadonlyArray<{
  sort: CommunityMembersSort;
  dir: "asc" | "desc";
  label: string;
  description: string;
}> = [
  {
    sort: "last",
    dir: "desc",
    label: "Last online",
    description: "Most recently active first",
  },
  {
    sort: "last",
    dir: "asc",
    label: "Last online",
    description: "Longest idle first",
  },
  {
    sort: "name",
    dir: "asc",
    label: "Name",
    description: "Alphabetical A–Z",
  },
  {
    sort: "name",
    dir: "desc",
    label: "Name",
    description: "Reverse alphabetical Z–A",
  },
  {
    sort: "level",
    dir: "desc",
    label: "Program level",
    description: "Highest level first",
  },
  {
    sort: "level",
    dir: "asc",
    label: "Program level",
    description: "Lowest level first",
  },
];

function compareName(
  a: CommunityRosterMember,
  b: CommunityRosterMember
): number {
  return displayName(a).localeCompare(displayName(b), undefined, {
    sensitivity: "base",
  });
}

export function CommunityMembersView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [membersListPage, setMembersListPage] = useState(1);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const base = pathname.startsWith("/admin")
    ? "/admin/community"
    : "/coach/community";

  const filter = useMemo(
    () => parseFilter(searchParams.get("filter")),
    [searchParams]
  );

  const sort = useMemo(
    () => parseSort(searchParams.get("sort")),
    [searchParams]
  );

  const dir = useMemo(
    () => parseDir(searchParams.get("dir"), sort),
    [searchParams, sort]
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

    const lastMs = (id: string) => {
      const iso = lastSeenByUserId[id];
      if (!iso) return 0;
      const t = new Date(iso).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    if (sort === "name") {
      list.sort((a, b) => {
        const c = compareName(a, b);
        return dir === "asc" ? c : -c;
      });
    } else if (sort === "level") {
      list.sort((a, b) => {
        const oa = ladderOrdinal(a.ladder_level) ?? 0;
        const ob = ladderOrdinal(b.ladder_level) ?? 0;
        const byLevel = dir === "desc" ? ob - oa : oa - ob;
        if (byLevel !== 0) return byLevel;
        return compareName(a, b);
      });
    } else {
      list.sort((a, b) => {
        const ta = lastMs(a.id);
        const tb = lastMs(b.id);
        const bySeen = dir === "desc" ? tb - ta : ta - tb;
        if (bySeen !== 0) return bySeen;
        return compareName(a, b);
      });
    }
    return list;
  }, [roster, filter, sort, dir, lastSeenByUserId, clock]);

  useEffect(() => {
    setMembersListPage(1);
  }, [filter, sort, dir]);

  const membersTotalPages = Math.max(
    1,
    Math.ceil(filtered.length / MEMBERS_PER_PAGE)
  );

  const pagedMembers = useMemo(() => {
    const start = (membersListPage - 1) * MEMBERS_PER_PAGE;
    return filtered.slice(start, start + MEMBERS_PER_PAGE);
  }, [filtered, membersListPage]);

  const membersRangeLabel = useMemo(() => {
    if (filtered.length === 0) return "0 of 0";
    const start = (membersListPage - 1) * MEMBERS_PER_PAGE + 1;
    const end = Math.min(membersListPage * MEMBERS_PER_PAGE, filtered.length);
    return `${start}-${end} of ${filtered.length.toLocaleString()}`;
  }, [filtered.length, membersListPage]);

  const membersPageNumbers = useMemo(
    () => paginationItems(membersListPage, membersTotalPages),
    [membersListPage, membersTotalPages]
  );

  const pillHref = (id: CommunityMembersFilter) =>
    `${base}/members${membersQuery(id, sort, dir)}`;

  const sortOptionHref = (s: CommunityMembersSort, d: "asc" | "desc") =>
    `${base}/members${membersQuery(filter, s, d)}`;

  useEffect(() => {
    if (!sortMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = sortMenuRef.current;
      if (el && !el.contains(e.target as Node)) setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sortMenuOpen]);

  const activeSortOption = useMemo(
    () =>
      SORT_MENU_OPTIONS.find((o) => o.sort === sort && o.dir === dir) ??
      SORT_MENU_OPTIONS[0],
    [sort, dir]
  );

  const sortMenuIsNonDefault = sort !== "last" || dir !== "desc";
  const linkedinStatus = searchParams.get("linkedin");

  const pillClass = (id: CommunityMembersFilter) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      filter === id
        ? "bg-sky-700 text-white"
        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  const countClass = (id: CommunityMembersFilter) =>
    filter === id ? "text-sky-200" : "text-slate-500";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (!cancelled) setIsAdmin(roleBody.role === "admin");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnectLinkedIn() {
    if (connectingLinkedIn) return;
    setConnectingLinkedIn(true);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token ?? "";
      if (!token) {
        throw new Error("Please sign in again before connecting LinkedIn.");
      }

      const res = await fetch("/api/linkedin/connect", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Could not start LinkedIn connect.");
      }
      window.location.assign(body.url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start LinkedIn connect.";
      window.alert(message);
      setConnectingLinkedIn(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:justify-start lg:gap-10">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl min-w-0 flex-col pt-5 lg:mx-0 lg:pt-6">
      {isAdmin ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                LinkedIn publishing (admin beta)
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Connect your LinkedIn profile for member posting and scheduling.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConnectLinkedIn}
              disabled={connectingLinkedIn}
              className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectingLinkedIn ? "Redirecting…" : "Connect LinkedIn"}
            </button>
          </div>
          {linkedinStatus ? (
            <p
              className={`mt-2 text-xs ${
                linkedinStatus === "connected"
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}
            >
              {linkedinStatus === "connected"
                ? "LinkedIn connected successfully."
                : `LinkedIn status: ${linkedinStatus.replaceAll("_", " ")}`}
            </p>
          ) : null}
        </div>
      ) : null}
      {loadError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {loadError}
        </p>
      ) : null}

      <div
        className={`flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 ${
          loadError ? "mt-4" : ""
        }`}
      >
        <div className="flex min-w-0 flex-wrap gap-2">
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
        <div className="relative ml-auto shrink-0 pt-0.5" ref={sortMenuRef}>
          <button
            type="button"
            aria-expanded={sortMenuOpen}
            aria-haspopup="menu"
            aria-label={`Sort members: ${activeSortOption.label} — ${activeSortOption.description}`}
            onClick={() => setSortMenuOpen((o) => !o)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
              sortMenuIsNonDefault
                ? "bg-sky-50 text-sky-800 ring-2 ring-sky-600"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <ArrowUpDown
              className="h-4 w-4 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
          </button>
          {sortMenuOpen ? (
            <div
              role="menu"
              aria-label="Sort members"
              className="absolute right-0 z-30 mt-1 w-[min(100vw-1.5rem,17rem)] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {SORT_MENU_OPTIONS.map((opt) => {
                const selected = opt.sort === sort && opt.dir === dir;
                return (
                  <Link
                    key={`${opt.sort}-${opt.dir}`}
                    href={sortOptionHref(opt.sort, opt.dir)}
                    role="menuitem"
                    onClick={() => setSortMenuOpen(false)}
                    className={`flex flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors ${
                      selected
                        ? "bg-sky-50 font-medium text-sky-900"
                        : "text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`text-xs font-normal leading-snug ${
                        selected ? "text-sky-800/90" : "text-slate-500"
                      }`}
                    >
                      {opt.description}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {pagedMembers.map((m) => {
          const name = displayName(m);
          const initials = profileInitialsFromName(name);
          const sub =
            m.coach_business_name?.trim() &&
            m.coach_business_name.trim() !== name
              ? m.coach_business_name.trim()
              : null;
          const online = isCommunityOnline(lastSeenByUserId[m.id], clock);
          const profileHref =
            m.directory_listed && m.slug ? `/directory/${m.slug}` : null;
          const joined = formatJoined(
            m.disco_community_joined_on ?? m.created_at
          );

          return (
            <li
              key={m.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={`h-14 w-14 rounded-full object-cover ring-2 ring-white ${
                        m.role === "admin"
                          ? "shadow-[0_0_0_3px_rgb(2_132_199)]"
                          : "shadow-[0_0_0_1px_rgb(226_232_240)]"
                      }`}
                    />
                  ) : (
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-600 ring-2 ring-white ${
                        m.role === "admin"
                          ? "shadow-[0_0_0_3px_rgb(2_132_199)]"
                          : "shadow-[0_0_0_1px_rgb(226_232_240)]"
                      }`}
                    >
                      {initials}
                    </div>
                  )}
                  {online && !presenceUnavailable ? (
                    <span
                      className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"
                      title="Online now"
                      aria-label="Online now"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate font-semibold text-slate-900">
                      {name}
                    </p>
                    {!presenceUnavailable ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          online
                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
                            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        }`}
                      >
                        {online ? "Online" : "Offline"}
                      </span>
                    ) : null}
                    {m.role === "admin" ? (
                      <span className="text-xs font-medium text-sky-600">
                        Admin
                      </span>
                    ) : null}
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
                    {!presenceUnavailable &&
                    !online &&
                    lastSeenByUserId[m.id] ? (
                      <span>
                        Last seen{" "}
                        {formatLastSeen(lastSeenByUserId[m.id], clock)}
                      </span>
                    ) : null}
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

      {!loadError && membersTotalPages > 1 ? (
        <nav
          className="mt-6 flex flex-col gap-3 rounded-xl bg-[#F9F9F9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Members pagination"
        >
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={membersListPage <= 1}
              onClick={() =>
                setMembersListPage((p) => Math.max(1, p - 1))
              }
              className="inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-sm font-medium text-[#666666] disabled:cursor-not-allowed disabled:text-[#CCCCCC]"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              Previous
            </button>
            <div className="flex flex-wrap items-center gap-1 pl-1">
              {membersPageNumbers.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`e-${idx}`}
                    className="px-1.5 text-sm text-[#666666]"
                    aria-hidden
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMembersListPage(item)}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium ${
                      item === membersListPage
                        ? "bg-[#F9E4B7] text-[#666666]"
                        : "text-[#666666] hover:bg-black/[0.04]"
                    }`}
                    aria-current={
                      item === membersListPage ? "page" : undefined
                    }
                  >
                    {item}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              disabled={membersListPage >= membersTotalPages}
              onClick={() =>
                setMembersListPage((p) =>
                  Math.min(membersTotalPages, p + 1)
                )
              }
              className="inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-sm font-medium text-[#666666] disabled:cursor-not-allowed disabled:text-[#CCCCCC]"
            >
              Next
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
          <p className="text-sm text-[#666666] sm:text-right">
            {membersRangeLabel}
          </p>
        </nav>
      ) : null}

      {!loadError && filtered.length === 0 ? (
        <p className="mt-8 py-6 text-center text-sm text-slate-500">
          No one in this list yet.
        </p>
      ) : null}
      </div>
      <CommunitySidebar className="pt-5 lg:pt-6" />
    </div>
  );
}
