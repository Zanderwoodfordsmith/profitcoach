"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Play,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  DashboardPageSection,
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { useDashboardChrome } from "@/contexts/DashboardChromeContext";
import { SearchHighlight } from "@/components/search/SearchHighlight";
import { SearchRecentList } from "@/components/search/SearchRecentList";
import { useSearchRecents } from "@/components/search/useSearchRecents";
import { PostCard } from "@/components/community/PostCard";
import {
  fetchEnrichedCommunityPostsByIds,
  type CommunityPostRow,
} from "@/components/community/CommunityFeed";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { paginationItems } from "@/lib/communityPagination";
import { fetchCommunityMentionNameMap } from "@/lib/communityFetchMentionNameMap";
import { extractMentionUserIds } from "@/lib/communityMentions";
import { formatCommunityPostTimestamp } from "@/lib/communityRelativeTime";
import { queueAiPrompt } from "@/lib/profitCoachAi/queuedPrompt";
import {
  searchLessonHref,
  searchMemberHref,
  searchPostHref,
  searchPrefix,
} from "@/lib/search/paths";
import { takeSearchReturn } from "@/lib/search/returnTo";
import {
  formatCourseBreadcrumb,
  parseSearchTab,
  memberDisplayName,
  normalizeSearchQuery,
  SEARCH_INPUT_ID,
  type SearchClassroomItem,
  type SearchCommunityItem,
  type SearchCounts,
  type SearchMemberItem,
  type SearchTab,
} from "@/lib/search/types";
import "./searchMotion.css";

const EMPTY_COUNTS: SearchCounts = {
  community: 0,
  classroom: 0,
  members: 0,
};

const TABS: Array<{ id: SearchTab; label: string }> = [
  { id: "classroom", label: "Classroom" },
  { id: "community", label: "Community" },
  { id: "members", label: "Members" },
];

const SEARCH_CARD_CLASS =
  "flex w-full gap-3 rounded-2xl border border-slate-200 bg-white py-4 px-[1.125rem] text-left shadow-[0_1px_2px_rgb(15_23_42/0.05),0_3px_8px_-3px_rgb(15_23_42/0.08)] transition hover:border-slate-300 hover:shadow";

const PLACEHOLDER = "Search lessons, videos, posts and people";

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

function ResultsSkeleton() {
  return (
    <ul aria-hidden className="space-y-[1.125rem]">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="rounded-2xl border border-slate-200 bg-white px-[1.125rem] py-4"
        >
          <div className="h-3 w-32 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-3 h-5 w-3/4 animate-pulse rounded-full bg-slate-200/70" />
          <div className="mt-3 h-3.5 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="mt-2 h-3.5 w-5/6 animate-pulse rounded-full bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}

export function SearchPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chrome = useDashboardChrome();
  const prefix = searchPrefix(pathname);
  const resourcesBase = `${prefix}/academy/resources`;

  const qFromUrl = normalizeSearchQuery(searchParams.get("q"));
  const tabFromUrl: SearchTab = parseSearchTab(searchParams.get("tab"));
  const pageFromUrl = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  /** Results mode. Below two characters the page shows recently opened. */
  const active = qFromUrl.length >= 2;

  const [value, setValue] = useState(qFromUrl);
  // Back / forward and tab links change the URL; keep the box in step with it.
  const [syncedQ, setSyncedQ] = useState(qFromUrl);
  if (syncedQ !== qFromUrl) {
    setSyncedQ(qFromUrl);
    setValue(qFromUrl);
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<SearchCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  /** Tab the current items belong to, so a tab switch shows a skeleton, not the old list. */
  const [loadedTab, setLoadedTab] = useState<SearchTab | null>(null);
  const [communityItems, setCommunityItems] = useState<SearchCommunityItem[]>([]);
  const [classroomItems, setClassroomItems] = useState<SearchClassroomItem[]>([]);
  const [memberItems, setMemberItems] = useState<SearchMemberItem[]>([]);
  const [feedPostsById, setFeedPostsById] = useState<
    Map<string, CommunityPostRow>
  >(new Map());
  const [feedMentionNameById, setFeedMentionNameById] = useState<
    Record<string, string>
  >({});
  const recent = useSearchRecents(prefix);

  const inputRef = useRef<HTMLInputElement>(null);

  const replaceQuery = useCallback(
    (next: { q?: string; tab?: SearchTab; page?: number }, push = false) => {
      const params = new URLSearchParams();
      const q = next.q ?? qFromUrl;
      const tab = next.tab ?? tabFromUrl;
      const page = next.page ?? 1;
      if (q) params.set("q", q);
      if (tab !== "classroom") params.set("tab", tab);
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (push) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, qFromUrl, router, tabFromUrl]
  );

  useEffect(() => {
    if (!active) inputRef.current?.focus();
  }, [active]);

  // Esc goes back to the page that opened search (unless the AI panel has it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || chrome?.aiPanelOpen) return;
      const ret = takeSearchReturn(prefix, `${prefix}/search`);
      if (ret) router.push(ret);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chrome?.aiPanelOpen, prefix, router]);

  useEffect(() => {
    if (qFromUrl.length < 2) {
      setCounts(EMPTY_COUNTS);
      setTotal(0);
      setLoadedTab(null);
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
          if (!cancelled) setError(body.error ?? "Search failed. Try again.");
          return;
        }
        if (cancelled) return;
        setCounts(body.counts ?? EMPTY_COUNTS);
        setTotal(body.total ?? 0);
        setPageSize(body.pageSize ?? 20);
        setLoadedTab(tabFromUrl);
        if (tabFromUrl === "community") {
          setCommunityItems((body.items as SearchCommunityItem[]) ?? []);
        } else if (tabFromUrl === "classroom") {
          setClassroomItems((body.items as SearchClassroomItem[]) ?? []);
        } else {
          setMemberItems((body.items as SearchMemberItem[]) ?? []);
        }
      } catch {
        if (!cancelled) setError("Search failed. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const t = window.setTimeout(run, 120);
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

  const canAskAi = Boolean(chrome?.showAi) && !chrome?.profileLoading;

  const showSkeleton = active && loading && loadedTab !== tabFromUrl;
  const showList = active && !showSkeleton && loadedTab === tabFromUrl;
  const refreshing = loading && !showSkeleton;
  const otherTabsWithHits = TABS.filter(
    (t) => t.id !== tabFromUrl && counts[t.id] > 0
  );
  const tabLabel = TABS.find((t) => t.id === tabFromUrl)?.label ?? "Classroom";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = normalizeSearchQuery(value);
    if (!q) {
      // Enter on an empty box goes back to the start screen.
      if (active) replaceQuery({ q: "", page: 1 });
      return;
    }
    if (q.length < 2 || (q === qFromUrl && pageFromUrl === 1)) return;
    // From recently opened, push so Back returns to it; refinements replace.
    replaceQuery({ q, page: 1 }, !active);
  };

  const clear = () => {
    setValue("");
    inputRef.current?.focus();
  };

  const askAi = () => {
    const text = normalizeSearchQuery(value) || qFromUrl;
    if (text) queueAiPrompt(text);
    if (!chrome?.aiPanelOpen) chrome?.onToggleAi();
  };

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-3xl"
      gapClass="gap-0"
      outerClassName="pb-16"
      header={<StickyPageHeader title="Search" />}
    >
      <div className="pt-6">
        <form role="search" onSubmit={submit}>
          <div className="flex h-14 items-center gap-1 rounded-full border border-slate-200 bg-white pl-5 pr-2 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_24px_-12px_rgb(15_23_42/0.18)] transition-[border-color,box-shadow] duration-200 focus-within:border-sky-300 focus-within:shadow-[0_1px_2px_rgb(15_23_42/0.06),0_0_0_4px_rgb(14_165_233/0.12),0_10px_28px_-12px_rgb(15_23_42/0.22)]">
            <Search
              aria-hidden
              className="h-5 w-5 shrink-0 text-slate-400"
              strokeWidth={1.75}
            />
            <input
              ref={inputRef}
              id={SEARCH_INPUT_ID}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={PLACEHOLDER}
              aria-label={PLACEHOLDER}
              className="min-w-0 flex-1 bg-transparent px-2 text-base text-slate-900 caret-sky-600 outline-none placeholder:text-slate-500 sm:text-lg [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {value ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clear}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            ) : null}
            {canAskAi ? (
              <>
                <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
                <button
                  type="button"
                  onClick={askAi}
                  aria-label="Ask AI"
                  title="Ask Profit Coach AI"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Ask AI</span>
                </button>
              </>
            ) : null}
          </div>
        </form>

        {!active && recent ? (
          recent.length > 0 ? (
            <div className="mt-10">
              <SearchRecentList recent={recent} />
            </div>
          ) : (
            <p className="search-fade-in mt-10 text-center text-base text-slate-600">
              Try a lesson name, a phrase from a video, or a member&apos;s name.
            </p>
          )
        ) : null}

        {active ? (
          <div className="search-fade-in mt-4">
            <div className="border-b border-slate-200">
              <PageHeaderUnderlineTabs
                placement="content"
                ariaLabel="Search categories"
                items={TABS.map((t) => ({
                  kind: "button" as const,
                  id: t.id,
                  label: (
                    <span className="inline-flex items-baseline gap-1.5">
                      <span>{t.label}</span>
                      <span
                        className={`tabular-nums ${
                          tabFromUrl === t.id
                            ? "font-medium text-sky-800/70"
                            : "font-normal text-slate-500"
                        }`}
                      >
                        {loadedTab ? counts[t.id] : ""}
                      </span>
                    </span>
                  ),
                  active: tabFromUrl === t.id,
                  onClick: () => replaceQuery({ tab: t.id, page: 1 }),
                }))}
              />
            </div>

            <p role="status" className="sr-only">
              {loading ? "Searching" : `${total} results in ${tabLabel}`}
            </p>

            <div
              aria-busy={loading}
              className={`mt-6 flex flex-col gap-[1.125rem] transition-opacity duration-200 ${
                refreshing ? "opacity-60" : ""
              }`}
            >
              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              {showSkeleton ? <ResultsSkeleton /> : null}

              {showList && !error && total === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
                  <p className="text-base font-medium text-slate-900">
                    {otherTabsWithHits.length > 0
                      ? `Nothing in ${tabLabel} for “${qFromUrl}”.`
                      : `No results for “${qFromUrl}”.`}
                  </p>
                  {otherTabsWithHits.length > 0 ? (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {otherTabsWithHits.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => replaceQuery({ tab: t.id, page: 1 })}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                        >
                          {counts[t.id]} in {t.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-base text-slate-600">
                      Try fewer words, or a phrase you remember from a video.
                    </p>
                  )}
                  {canAskAi ? (
                    <button
                      type="button"
                      onClick={askAi}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                    >
                      <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                      Ask AI instead
                    </button>
                  ) : null}
                </div>
              ) : null}

              {showList && tabFromUrl === "community" && communityItems.length > 0 ? (
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
                          onOpen={() => router.push(searchPostHref(prefix, item))}
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

              {showList && tabFromUrl === "classroom" && classroomItems.length > 0 ? (
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
                        <Link href={searchLessonHref(prefix, item)} className={SEARCH_CARD_CLASS}>
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
                                {": "}
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

              {showList && tabFromUrl === "members" && memberItems.length > 0 ? (
                <ul className="space-y-[1.125rem]">
                  {memberItems.map((m) => {
                    const name = memberDisplayName(m);
                    const href = searchMemberHref(prefix, m);
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

              {showList && total > pageSize ? (
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
            </div>
          </div>
        ) : null}
      </div>
    </DashboardPageSection>
  );
}
