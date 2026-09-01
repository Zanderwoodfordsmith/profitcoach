"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Play,
  UserRound,
} from "lucide-react";
import {
  DashboardPageSection,
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { SearchHighlight } from "@/components/search/SearchHighlight";
import { PostCard } from "@/components/community/PostCard";
import {
  fetchEnrichedCommunityPostsByIds,
  type CommunityPostRow,
} from "@/components/community/CommunityFeed";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { paginationItems } from "@/lib/communityPagination";
import { communityPostPath } from "@/lib/communityPostSlug";
import { fetchCommunityMentionNameMap } from "@/lib/communityFetchMentionNameMap";
import { extractMentionUserIds } from "@/lib/communityMentions";
import { formatCommunityPostTimestamp } from "@/lib/communityRelativeTime";
import {
  formatCourseBreadcrumb,
  parseSearchTab,
  memberDisplayName,
  normalizeSearchQuery,
  seekSecondsForTranscriptHit,
  type SearchClassroomItem,
  type SearchCommunityItem,
  type SearchCounts,
  type SearchMemberItem,
  type SearchTab,
} from "@/lib/search/types";

const EMPTY_COUNTS: SearchCounts = {
  community: 0,
  classroom: 0,
  members: 0,
};

const SEARCH_CARD_CLASS =
  "flex w-full gap-3 rounded-2xl border border-slate-200 bg-white py-4 px-[1.125rem] text-left shadow-[0_1px_2px_rgb(15_23_42/0.05),0_3px_8px_-3px_rgb(15_23_42/0.08)] transition hover:border-slate-300 hover:shadow";

function stubPostFromSearch(item: SearchCommunityItem): CommunityPostRow {
  return {
    id: item.id,
    title: item.title,
    body: item.body_preview ?? "",
    media: [],
    poll: null,
    poll_vote_count: 0,
    poll_voted_option_id: null,
    image_url: null,
    is_pinned: false,
    published_at: item.published_at,
    created_at: item.created_at,
    category_id: "",
    category: item.category_label
      ? { id: "", slug: "", label: item.category_label }
      : null,
    author: item.author
      ? {
          id: item.author.id,
          full_name: item.author.full_name,
          first_name: item.author.first_name,
          last_name: item.author.last_name,
          avatar_url: item.author.avatar_url,
        }
      : null,
    like_count: item.like_count,
    comment_count: item.comment_count,
    liked_by_me: false,
    commented_by_me: false,
    favourited_by_me: false,
    comment_preview_authors: [],
    last_comment_at: null,
  };
}

function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function SearchPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const communityBase = `${prefix}/community`;
  const classroomBase = `${prefix}/academy/classroom`;
  const resourcesBase = `${prefix}/academy/resources`;
  const membersHref = `${communityBase}/members`;

  const qFromUrl = normalizeSearchQuery(searchParams.get("q"));
  const tabFromUrl: SearchTab = parseSearchTab(searchParams.get("tab"));
  const pageFromUrl = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<SearchCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [communityItems, setCommunityItems] = useState<SearchCommunityItem[]>([]);
  const [classroomItems, setClassroomItems] = useState<SearchClassroomItem[]>([]);
  const [memberItems, setMemberItems] = useState<SearchMemberItem[]>([]);
  const [feedPostsById, setFeedPostsById] = useState<
    Map<string, CommunityPostRow>
  >(new Map());
  const [feedMentionNameById, setFeedMentionNameById] = useState<
    Record<string, string>
  >({});

  const replaceQuery = useCallback(
    (next: { q?: string; tab?: SearchTab; page?: number }) => {
      const params = new URLSearchParams();
      const q = next.q ?? qFromUrl;
      const tab = next.tab ?? tabFromUrl;
      const page = next.page ?? 1;
      if (q) params.set("q", q);
      if (tab !== "classroom") params.set("tab", tab);
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, qFromUrl, router, tabFromUrl]
  );

  useEffect(() => {
    if (qFromUrl.length < 2) {
      setCounts(EMPTY_COUNTS);
      setTotal(0);
      setCommunityItems([]);
      setClassroomItems([]);
      setMemberItems([]);
      setFeedPostsById(new Map());
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getValidSupabaseAccessToken();
        if (!token) {
          if (!cancelled) setError("Sign in to search.");
          return;
        }
        const params = new URLSearchParams({
          q: qFromUrl,
          tab: tabFromUrl,
          page: String(pageFromUrl),
        });
        const res = await fetch(`/api/search?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as {
          error?: string;
          counts?: SearchCounts;
          total?: number;
          pageSize?: number;
          items?: unknown[];
        };
        if (!res.ok) {
          if (!cancelled) setError(body.error ?? "Search failed.");
          return;
        }
        if (cancelled) return;
        setCounts(body.counts ?? EMPTY_COUNTS);
        setTotal(body.total ?? 0);
        setPageSize(body.pageSize ?? 20);
        if (tabFromUrl === "community") {
          setCommunityItems((body.items as SearchCommunityItem[]) ?? []);
        } else if (tabFromUrl === "classroom") {
          setClassroomItems((body.items as SearchClassroomItem[]) ?? []);
        } else {
          setMemberItems((body.items as SearchMemberItem[]) ?? []);
        }
      } catch {
        if (!cancelled) setError("Search failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const t = window.setTimeout(run, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [qFromUrl, tabFromUrl, pageFromUrl]);

  useEffect(() => {
    if (tabFromUrl !== "community" || communityItems.length === 0) {
      if (communityItems.length === 0) setFeedPostsById(new Map());
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        const rows = await fetchEnrichedCommunityPostsByIds(
          communityItems.map((item) => item.id),
          { viewerProfileId: user?.id ?? null }
        );
        if (cancelled) return;
        setFeedPostsById(new Map(rows.map((row) => [row.id, row])));
        const mentionIds = rows.flatMap((row) =>
          extractMentionUserIds(row.body)
        );
        if (mentionIds.length === 0) {
          setFeedMentionNameById({});
          return;
        }
        const names = await fetchCommunityMentionNameMap(mentionIds);
        if (!cancelled) setFeedMentionNameById(names);
      } catch {
        if (!cancelled) setFeedPostsById(new Map());
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [communityItems, tabFromUrl]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = useMemo(
    () => paginationItems(pageFromUrl, totalPages),
    [pageFromUrl, totalPages]
  );

  const showCounts = qFromUrl.length >= 2;
  const tabLabel = (id: SearchTab, label: string, count: number) =>
    showCounts ? (
      <span className="inline-flex items-baseline gap-1.5">
        <span>{label}</span>
        <span
          className={
            tabFromUrl === id
              ? "font-medium text-sky-800/70"
              : "font-normal text-slate-400"
          }
        >
          {count}
        </span>
      </span>
    ) : (
      label
    );

  const postHref = (post: SearchCommunityItem) => {
    if (post.post_scope === "lesson_qa" && post.lesson_path) {
      return post.lesson_path.startsWith("/")
        ? post.lesson_path
        : `/${post.lesson_path}`;
    }
    return communityPostPath(communityBase, { title: post.title });
  };

  const lessonHref = (item: SearchClassroomItem) => {
    if (!item.course_id || !item.lesson_id) return classroomBase;
    const base = `${classroomBase}/${encodeURIComponent(item.course_id)}/${encodeURIComponent(item.lesson_id)}`;
    const params = new URLSearchParams();
    if (item.chapter_id) params.set("chapter", item.chapter_id);
    if (item.transcript_match && item.transcript_seconds != null) {
      params.set("t", String(seekSecondsForTranscriptHit(item.transcript_seconds)));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-3xl"
      gapClass="gap-5"
      outerClassName="pb-16"
      header={
        <StickyPageHeader
          title="Search"
          description="Find lessons, posts, and members across the academy."
          tabs={
            <PageHeaderUnderlineTabs
              ariaLabel="Search categories"
              items={[
                {
                  kind: "button",
                  id: "classroom",
                  label: tabLabel("classroom", "Classroom", counts.classroom),
                  active: tabFromUrl === "classroom",
                  onClick: () =>
                    replaceQuery({ tab: "classroom", page: 1 }),
                },
                {
                  kind: "button",
                  id: "community",
                  label: tabLabel("community", "Community", counts.community),
                  active: tabFromUrl === "community",
                  onClick: () =>
                    replaceQuery({ tab: "community", page: 1 }),
                },
                {
                  kind: "button",
                  id: "members",
                  label: tabLabel("members", "Members", counts.members),
                  active: tabFromUrl === "members",
                  onClick: () => replaceQuery({ tab: "members", page: 1 }),
                },
              ]}
            />
          }
        />
      }
    >
        {qFromUrl.length < 2 ? (
          <div className="px-1 pt-6 text-center">
            <p className="text-base text-slate-600">
              Find a lesson, a post, or a person.
            </p>
            <ul className="mt-5 space-y-1.5 text-sm text-slate-500">
              <li>A lesson or chapter name</li>
              <li>A phrase from a video</li>
              <li>A member, or something they posted</li>
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="px-1 py-6 text-sm text-slate-500">Searching…</p>
        ) : null}

        {!loading && !error && qFromUrl.length >= 2 && total === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No results for “{qFromUrl}”.
          </p>
        ) : null}

        {!loading && tabFromUrl === "community" && communityItems.length > 0 ? (
          <ul className="space-y-[1.125rem]">
            {communityItems.map((item) => {
              const post = feedPostsById.get(item.id) ?? stubPostFromSearch(item);
              const matchedComments = (item.comments ?? [])
                .filter((c) => c.headline)
                .slice(0, 3);
              return (
                <li key={item.id}>
                  <PostCard
                    post={post}
                    feedMentionNameById={feedMentionNameById}
                    feedCardHasBeenRead={false}
                    onOpen={() => router.push(postHref(item))}
                    titleHighlightHtml={item.title_headline}
                    bodyHighlightHtml={item.body_headline}
                  >
                    {matchedComments.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {matchedComments.map((comment) => (
                          <li
                            key={comment.id}
                            className="rounded-xl bg-slate-50/80 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <CommunityAuthorAvatar
                                profile={comment.author ?? null}
                                size="sm"
                              />
                              <span className="text-[15px] font-semibold text-slate-900">
                                {memberDisplayName(comment.author ?? {})}
                              </span>
                              {comment.created_at ? (
                                <span className="text-[13px] text-slate-500">
                                  {formatCommunityPostTimestamp(
                                    comment.created_at
                                  )}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-3 text-base leading-relaxed text-slate-600">
                              <SearchHighlight html={comment.headline} />
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </PostCard>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!loading && tabFromUrl === "classroom" && classroomItems.length > 0 ? (
          <ul className="space-y-[1.125rem]">
            {classroomItems.map((item) => {
              if (item.kind === "resource") {
                return (
                  <li key={`resource-${item.id}`}>
                    <a
                      href={item.url || resourcesBase}
                      target={item.url ? "_blank" : undefined}
                      rel={item.url ? "noreferrer" : undefined}
                      className={SEARCH_CARD_CLASS}
                    >
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          Resources
                          {item.section_title ? ` · ${item.section_title}` : ""}
                        </p>
                        <h2 className="mt-0.5 text-xl font-semibold leading-snug tracking-tight text-slate-900">
                          <SearchHighlight
                            html={item.title_headline}
                            fallback={item.title}
                          />
                        </h2>
                        {item.body_headline || item.topic ? (
                          <p className="mt-1 text-base leading-relaxed text-slate-600">
                            <SearchHighlight
                              html={item.body_headline}
                              fallback={item.topic}
                            />
                          </p>
                        ) : null}
                      </div>
                    </a>
                  </li>
                );
              }

              return (
                <li key={`lesson-${item.id}`}>
                  <Link href={lessonHref(item)} className={SEARCH_CARD_CLASS}>
                    {item.transcript_match && !item.content_match ? (
                      <Play className="mt-1 h-5 w-5 shrink-0 text-sky-700" />
                    ) : (
                      <BookOpen className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        {formatCourseBreadcrumb(item.course_id)}
                        {item.chapter_title ? ` · ${item.chapter_title}` : ""}
                      </p>
                      <h2 className="mt-0.5 text-xl font-semibold leading-snug tracking-tight text-slate-900">
                        <SearchHighlight
                          html={item.title_headline}
                          fallback={item.title}
                        />
                      </h2>
                      {item.body_headline ? (
                        <p className="mt-1 line-clamp-2 text-base leading-relaxed text-slate-600">
                          <SearchHighlight html={item.body_headline} />
                        </p>
                      ) : null}
                      {item.transcript_headline ? (
                        <p className="mt-1.5 line-clamp-2 text-base italic leading-relaxed text-slate-500">
                          Transcript
                          {item.transcript_clock
                            ? ` · ${item.transcript_clock}`
                            : ""}
                          {" — "}
                          <SearchHighlight html={item.transcript_headline} />
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!loading && tabFromUrl === "members" && memberItems.length > 0 ? (
          <ul className="space-y-[1.125rem]">
            {memberItems.map((m) => {
              const name = memberDisplayName(m);
              const href = m.slug
                ? `/directory/${encodeURIComponent(m.slug)}`
                : membersHref;
              return (
                <li key={m.id}>
                  <Link href={href} className={`${SEARCH_CARD_CLASS} items-start`}>
                    <CommunityAuthorAvatar
                      profile={{
                        id: m.id,
                        full_name: m.full_name,
                        first_name: m.first_name,
                        last_name: m.last_name,
                        avatar_url: m.avatar_url,
                        role: m.role,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h2 className="text-base font-semibold leading-tight text-slate-900">
                          {name}
                        </h2>
                        {m.slug ? (
                          <span className="text-sm text-slate-500">@{m.slug}</span>
                        ) : null}
                      </div>
                      {m.bio_headline || m.bio ? (
                        <p className="mt-1 line-clamp-2 text-base leading-relaxed text-slate-600">
                          <SearchHighlight html={m.bio_headline} fallback={m.bio} />
                        </p>
                      ) : null}
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                        <UserRound className="h-3.5 w-3.5" />
                        {m.role === "admin" ? "Admin" : "Member"}
                        {m.created_at
                          ? ` · Joined ${formatMonthYear(m.created_at)}`
                          : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!loading && total > pageSize ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <button
              type="button"
              disabled={pageFromUrl <= 1}
              onClick={() => replaceQuery({ page: pageFromUrl - 1 })}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <div className="flex items-center gap-1">
              {pages.map((p, i) =>
                p === "ellipsis" ? (
                  <span key={`e-${i}`} className="px-1 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => replaceQuery({ page: p })}
                    className={`min-w-8 rounded-full px-2 py-1 text-center ${
                      p === pageFromUrl
                        ? "bg-amber-200 font-semibold text-amber-950"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              disabled={pageFromUrl >= totalPages}
              onClick={() => replaceQuery({ page: pageFromUrl + 1 })}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 disabled:opacity-40 hover:bg-slate-100"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
    </DashboardPageSection>
  );
}
