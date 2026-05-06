"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { isCommunityOnline } from "@/lib/communityPresence";
import { useCommunityMemberDirectory } from "@/components/community/useCommunityMemberDirectory";
import { LadderLevelUpsCard } from "@/components/community/LadderLevelUpsCard";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { CommunityProfileHoverCard } from "@/components/community/CommunityProfileHoverCard";

const BANNER_SRC = "/brand/profit-coach-logo-colour-white-bg.png";

const COMMUNITY_BLURB =
  "Connect with coaches and the Profit Coach team. Share wins, ask questions, and stay in the loop.";

function displayNameShort(m: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  coach_business_name: string | null;
}): string {
  const n =
    m.full_name?.trim() ||
    [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
    m.coach_business_name?.trim();
  return n || "Member";
}

function formatLastSeenBrief(lastSeenAt: string | undefined, nowMs: number): string {
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

export type CommunitySidebarCalendarAdd = {
  show: boolean;
  onClick: () => void;
};

export function CommunitySidebar({
  className,
  calendarAddEvent,
}: {
  className?: string;
  /** Shown on the community calendar tab for admins only */
  calendarAddEvent?: CommunitySidebarCalendarAdd;
} = {}) {
  const pathname = usePathname();
  const base = pathname.startsWith("/admin")
    ? "/admin/community"
    : "/coach/community";

  const {
    roster,
    lastSeenByUserId,
    presenceUnavailable,
    clock,
    counts,
  } = useCommunityMemberDirectory();

  const recentTwelve = useMemo(() => {
    const presenceRows = Object.entries(lastSeenByUserId).map(
      ([user_id, last_seen_at]) => ({ user_id, last_seen_at })
    );
    const sortedPresence = [...presenceRows].sort(
      (a, b) =>
        new Date(b.last_seen_at).getTime() -
        new Date(a.last_seen_at).getTime()
    );
    const slice = sortedPresence.slice(0, 12);
    const byId = new Map(roster.map((m) => [m.id, m]));
    const out: typeof roster = [];
    for (const row of slice) {
      const mem = byId.get(row.user_id);
      if (mem) out.push(mem);
    }
    return out;
  }, [lastSeenByUserId, roster]);

  const statLink = (
    href: string,
    value: number,
    label: string
  ) => (
    <Link
      key={href}
      href={href}
      className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-center transition-colors hover:bg-slate-50"
    >
      <span className="text-xl font-bold tabular-nums text-slate-900">
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
    </Link>
  );

  return (
    <aside
      className={[
        "w-full shrink-0 lg:w-80 lg:sticky lg:top-4 lg:self-start",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-hidden rounded-t-xl">
          <div className="relative aspect-[16/9] w-full bg-white">
            <Image
              src={BANNER_SRC}
              alt="Profit Coach"
              fill
              className="object-contain p-3"
              sizes="(max-width: 1024px) 100vw, 320px"
              priority={false}
            />
          </div>
        </div>
        <div className="p-4">
          <h2 className="text-lg font-bold leading-snug text-slate-900">
            Profit Coach Community
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {COMMUNITY_BLURB}
          </p>

          <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/80">
            {statLink(`${base}/members`, counts.members, "Members")}
            {statLink(`${base}/members?filter=online`, counts.online, "Online")}
            {statLink(`${base}/members?filter=admins`, counts.admins, "Admins")}
          </div>

          {calendarAddEvent?.show ? (
            <button
              type="button"
              onClick={calendarAddEvent.onClick}
              className="mt-4 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              Add event
            </button>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Recently active
            </p>
            {presenceUnavailable ? (
              <p className="text-xs text-slate-500">
                Presence will show here after the latest database migration is
                applied.
              </p>
            ) : recentTwelve.length === 0 ? (
              <p className="text-xs text-slate-500">
                No recent activity yet. Open the community on other devices to
                see avatars here.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentTwelve.map((m) => {
                  const online = isCommunityOnline(
                    lastSeenByUserId[m.id],
                    clock
                  );
                  const name = displayNameShort(m);
                  const initials = profileInitialsFromName(name);
                  const subline =
                    m.coach_business_name?.trim() &&
                    m.coach_business_name.trim() !== name
                      ? m.coach_business_name.trim()
                      : null;
                  const statusLabel = online
                    ? "Online now"
                    : formatLastSeenBrief(lastSeenByUserId[m.id], clock);
                  return (
                    <CommunityProfileHoverCard
                      key={m.id}
                      userId={m.id}
                      statusLabel={statusLabel}
                      profile={{
                        id: m.id,
                        full_name: m.full_name,
                        first_name: m.first_name,
                        last_name: m.last_name,
                        avatar_url: m.avatar_url,
                        role: m.role,
                        bio: m.bio,
                        coach_business_name: m.coach_business_name,
                        slug: m.slug,
                      }}
                    >
                      <div className="relative h-9 w-9 shrink-0">
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            {initials}
                          </div>
                        )}
                        {online ? (
                          <span
                            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
                            aria-label="Online"
                          />
                        ) : null}
                      </div>
                    </CommunityProfileHoverCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <LadderLevelUpsCard />
    </aside>
  );
}
