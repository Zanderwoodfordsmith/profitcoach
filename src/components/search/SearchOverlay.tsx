"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  MessageSquare,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useDashboardChrome } from "@/contexts/DashboardChromeContext";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { SearchHighlight } from "@/components/search/SearchHighlight";
import {
  RECENT_KIND,
  SearchIconTile,
  recentVisitMeta,
} from "@/components/search/SearchRecentList";
import { useSearchRecents } from "@/components/search/useSearchRecents";
import { formatCommunityRelativeActivityAgo } from "@/lib/communityRelativeTime";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { queueAiPrompt } from "@/lib/profitCoachAi/queuedPrompt";
import { OPEN_SEARCH_EVENT } from "@/lib/search/overlay";
import {
  searchLessonHref,
  searchMemberHref,
  searchPostHref,
  searchPrefix,
  searchResultsHref,
  type SearchPrefix,
} from "@/lib/search/paths";
import { rememberSearchReturn } from "@/lib/search/returnTo";
import {
  formatCourseBreadcrumb,
  memberDisplayName,
  normalizeSearchQuery,
  SEARCH_INPUT_ID,
  type SearchPreview,
} from "@/lib/search/types";
import "./searchMotion.css";

const LISTBOX_ID = "search-overlay-listbox";
const PLACEHOLDER = "Search lessons, videos, posts and people";

type Option = {
  key: string;
  href: string;
  /** Resource files open in a new tab and leave the overlay open. */
  external?: boolean;
  leading: ReactNode;
  title: ReactNode;
  meta: string;
  aside?: string;
  /** Runs before navigating (e.g. remember where search was opened). */
  onChoose?: () => void;
};

type Group = {
  id: string;
  label: string | null;
  count?: number;
  allHref?: string;
  options: Option[];
};

function optionId(index: number): string {
  return `search-option-${index}`;
}

function joinMeta(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

/** So Esc on the full results page can come back to where search was opened. */
function rememberSearchOrigin(prefix: SearchPrefix): void {
  rememberSearchReturn(
    `${window.location.pathname}${window.location.search}`,
    `${prefix}/search`
  );
}

/**
 * Search over whatever page you're on: greeting, box, recently opened, then
 * the top hits from every tab as you type. Enter with nothing chosen opens the
 * full results page. Mounted once per dashboard layout; the top bar opens it
 * with openSearchOverlay(), and Cmd/Ctrl+K toggles it.
 */
export function SearchOverlay() {
  const pathname = usePathname();
  const chrome = useDashboardChrome();
  const { profile, profileLoading } = useDashboardProfile();
  const prefix = searchPrefix(pathname);
  const onSearchPage = pathname === `${prefix}/search`;
  const [open, setOpen] = useState(false);

  // Close if the route changes underneath (Back, a link elsewhere).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      if (onSearchPage) {
        document.getElementById(SEARCH_INPUT_ID)?.focus();
        return;
      }
      setOpen((o) => !o);
    };
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [onSearchPage]);

  if (!open) return null;

  const firstName =
    profile?.first_name?.trim() ||
    profile?.full_name?.trim().split(/\s+/)[0] ||
    null;

  return (
    <SearchDialog
      prefix={prefix}
      greeting={profileLoading ? null : firstName ? `Hi, ${firstName}` : "Hi"}
      canAskAi={Boolean(chrome?.showAi) && !chrome?.profileLoading}
      onAskAi={(text) => {
        if (text) queueAiPrompt(text);
        setOpen(false);
        if (!chrome?.aiPanelOpen) chrome?.onToggleAi();
      }}
      onClose={() => setOpen(false)}
    />
  );
}

function SearchDialog({
  prefix,
  greeting,
  canAskAi,
  onAskAi,
  onClose,
}: {
  prefix: SearchPrefix;
  greeting: string | null;
  canAskAi: boolean;
  onAskAi: (text: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const boxTop = useRef<number | null>(null);

  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<SearchPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const recent = useSearchRecents(prefix);

  const q = normalizeSearchQuery(value);
  const searching = q.length >= 2;
  const showGreeting = value === "";
  const loading = searching && !error && preview?.q !== q;

  // Top layer + focus trap come from the native modal dialog.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    inputRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      previousFocus?.focus?.();
    };
  }, []);

  // Centre over the page content, clear of the sidebar and a docked AI panel;
  // the page blur also starts below the title bar, so app chrome stays sharp.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const place = () => {
      const main = document.querySelector("main")?.getBoundingClientRect();
      const header = document
        .querySelector("main [data-page-header]")
        ?.getBoundingClientRect();
      const left = main ? Math.max(0, main.left) : 0;
      const right = main ? Math.max(0, window.innerWidth - main.right) : 0;
      dialog.style.setProperty("--search-inset-left", `${left}px`);
      dialog.style.setProperty("--search-inset-right", `${right}px`);
      dialog.style.setProperty(
        "--search-inset-top",
        `${header ? Math.max(0, header.bottom) : 0}px`
      );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  // The box slides up when the greeting gives way to results (FLIP).
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const nextTop = box.getBoundingClientRect().top;
    const from = boxTop.current;
    boxTop.current = nextTop;
    if (from == null) return;
    const delta = from - nextTop;
    if (Math.abs(delta) < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    box.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
      { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }, [showGreeting]);

  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const token = await getValidSupabaseAccessToken();
        if (!token) {
          if (!cancelled) setError("Sign in to search.");
          return;
        }
        const res = await fetch(
          `/api/search?${new URLSearchParams({ q, preview: "1" })}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const body = (await res.json()) as SearchPreview & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "Search failed. Try again.");
          return;
        }
        setPreview(body);
      } catch {
        if (!cancelled) setError("Search failed. Check your connection and try again.");
      }
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, searching]);

  const groups = useMemo<Group[]>(() => {
    if (!searching) {
      if (!recent?.length) return [];
      return [
        {
          id: "recent",
          label: "Recently opened",
          options: recent.map((visit) => ({
            key: `recent-${visit.href}`,
            href: visit.href,
            leading: <SearchIconTile icon={RECENT_KIND[visit.kind].icon} />,
            title: visit.title,
            meta: recentVisitMeta(visit),
            aside: formatCommunityRelativeActivityAgo(visit.at),
          })),
        },
      ];
    }
    if (!preview) return [];

    const out: Group[] = [];
    const { counts } = preview;
    if (preview.classroom.length > 0) {
      out.push({
        id: "classroom",
        label: "Classroom",
        count: counts.classroom,
        allHref: searchResultsHref(prefix, preview.q, "classroom"),
        options: preview.classroom.map((item) =>
          item.kind === "resource"
            ? {
                key: `resource-${item.id}`,
                href: item.url || `${prefix}/academy/resources`,
                external: Boolean(item.url),
                leading: <SearchIconTile icon={FileText} />,
                title: <SearchHighlight html={item.title_headline} fallback={item.title} />,
                meta: joinMeta(["Resources", item.section_title]),
              }
            : {
                key: `lesson-${item.id}`,
                href: searchLessonHref(prefix, item),
                leading: (
                  <SearchIconTile
                    icon={item.transcript_match && !item.content_match ? Play : BookOpen}
                  />
                ),
                title: <SearchHighlight html={item.title_headline} fallback={item.title} />,
                meta: joinMeta([
                  formatCourseBreadcrumb(item.course_id),
                  item.chapter_title,
                  item.transcript_clock && item.transcript_seconds
                    ? `Said at ${item.transcript_clock}`
                    : null,
                ]),
              }
        ),
      });
    }
    if (preview.community.length > 0) {
      out.push({
        id: "community",
        label: "Community",
        count: counts.community,
        allHref: searchResultsHref(prefix, preview.q, "community"),
        options: preview.community.map((post) => ({
          key: `post-${post.id}`,
          href: searchPostHref(prefix, post),
          leading: <SearchIconTile icon={MessageSquare} />,
          title: (
            <SearchHighlight html={post.title_headline} fallback={post.title || "Post"} />
          ),
          meta: joinMeta([
            post.author ? memberDisplayName(post.author) : null,
            formatCommunityRelativeActivityAgo(post.published_at || post.created_at),
          ]),
        })),
      });
    }
    if (preview.members.length > 0) {
      out.push({
        id: "members",
        label: "Members",
        count: counts.members,
        allHref: searchResultsHref(prefix, preview.q, "members"),
        options: preview.members.map((m) => ({
          key: `member-${m.id}`,
          href: searchMemberHref(prefix, m),
          leading: (
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
          ),
          title: memberDisplayName(m),
          meta: m.slug ? `@${m.slug}` : m.role === "admin" ? "Admin" : "Member",
        })),
      });
    }
    if (out.length > 0) {
      out.push({
        id: "all",
        label: null,
        options: [
          {
            key: "all",
            href: searchResultsHref(prefix, preview.q),
            leading: <SearchIconTile icon={Search} />,
            title: `See all results for “${preview.q}”`,
            meta: joinMeta([
              `${counts.classroom} in Classroom`,
              `${counts.community} in Community`,
              `${counts.members} in Members`,
            ]),
            onChoose: () => rememberSearchOrigin(prefix),
          },
        ],
      });
    }
    return out;
  }, [prefix, preview, recent, searching]);

  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const indexByKey = useMemo(
    () => new Map(flat.map((o, i) => [o.key, i])),
    [flat]
  );
  const chosen = activeIndex >= 0 && activeIndex < flat.length ? activeIndex : -1;
  const noResults = searching && !loading && !error && preview != null && flat.length === 0;

  useEffect(() => {
    if (chosen < 0) return;
    document.getElementById(optionId(chosen))?.scrollIntoView({ block: "nearest" });
  }, [chosen]);

  const choose = (option: Option) => {
    option.onChoose?.();
    if (option.external) {
      window.open(option.href, "_blank", "noopener,noreferrer");
      return;
    }
    onClose();
    router.push(option.href);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (chosen >= 0) {
      choose(flat[chosen]);
      return;
    }
    if (!searching) return;
    rememberSearchOrigin(prefix);
    onClose();
    router.push(searchResultsHref(prefix, q));
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    }
  };

  const onOptionClick = (option: Option, e: ReactMouseEvent) => {
    option.onChoose?.();
    // Cmd/Ctrl/Shift-click opens a new tab; keep the overlay for the next pick.
    if (option.external || e.metaKey || e.ctrlKey || e.shiftKey) return;
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Esc closes only this; the AI panel behind listens on document too.
      onKeyDown={(e) => {
        if (e.key === "Escape") e.stopPropagation();
      }}
      className="search-dialog m-0 hidden h-dvh max-h-none w-full max-w-none items-start justify-center overflow-hidden border-0 bg-transparent p-0 open:flex"
    >
      {/* Blurs the page content (not the sidebar or title bar); more once results show. */}
      <div
        aria-hidden
        className={`search-scrim ${searching ? "search-scrim-active" : ""}`}
      />
      <div className="search-dialog-panel relative flex h-full w-full flex-col overflow-hidden sm:mt-[14vh] sm:h-auto sm:max-h-[min(50rem,78vh)] sm:max-w-[68rem] sm:rounded-[28px]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-md p-1.5 text-slate-600 transition hover:bg-white/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 sm:right-5 sm:top-5"
        >
          <X className="h-5 w-5" />
        </button>

        {showGreeting ? (
          <div className="search-fade-in px-6 pt-16 text-center sm:px-14 sm:pt-14">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {greeting ?? "\u00a0"}
            </h2>
            <p className="mt-2 text-lg text-slate-700">What can I find for you?</p>
          </div>
        ) : null}

        <form
          ref={boxRef}
          role="search"
          onSubmit={submit}
          className={`mx-auto w-full px-4 sm:max-w-[46rem] sm:px-0 ${showGreeting ? "pt-6 sm:pt-8" : "pt-16 sm:pt-14"}`}
        >
          <div className="search-glass-field flex h-14 items-center gap-1 rounded-full pl-5 pr-2">
            <Search aria-hidden className="h-5 w-5 shrink-0 text-slate-600" strokeWidth={1.75} />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={LISTBOX_ID}
              aria-autocomplete="list"
              aria-activedescendant={chosen >= 0 ? optionId(chosen) : undefined}
              aria-label={PLACEHOLDER}
              placeholder={PLACEHOLDER}
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setActiveIndex(-1);
                setError(null);
              }}
              onKeyDown={onInputKeyDown}
              className="min-w-0 flex-1 bg-transparent px-2 text-base text-slate-950 caret-sky-600 outline-none placeholder:text-slate-600 sm:text-lg [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {value ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setValue("");
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            ) : null}
            {canAskAi ? (
              <button
                type="button"
                onClick={() => onAskAi(q)}
                aria-label="Ask AI"
                title="Ask Profit Coach AI"
                className="search-ask-ai ml-1 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 sm:px-4"
              >
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-5 sm:mt-6 sm:px-10 sm:pb-14">
          <div className="mx-auto w-full sm:max-w-[46rem]">
          <p role="status" className="sr-only">
            {searching
              ? loading
                ? "Searching"
                : noResults
                  ? `No results for ${q}`
                  : `${flat.length} suggestions`
              : ""}
          </p>

          {error ? (
            <p className="px-4 py-6 text-center text-sm text-red-700">{error}</p>
          ) : null}

          {searching && loading && !preview ? (
            <div aria-hidden className="pt-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-900/[0.06]" />
                  <div className="min-w-0 flex-1">
                    <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-slate-900/[0.09]" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded-full bg-slate-900/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {noResults ? (
            <div className="search-fade-in px-6 py-8 text-center">
              <p className="text-base font-medium text-slate-900">
                No results for “{q}”.
              </p>
              <p className="mt-1.5 text-base text-slate-700">
                Try fewer words, or a phrase you remember from a video.
              </p>
              {canAskAi ? (
                <button
                  type="button"
                  onClick={() => onAskAi(q)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                  Ask AI instead
                </button>
              ) : null}
            </div>
          ) : null}

          {!searching && recent && recent.length === 0 ? (
            <p className="search-fade-in px-6 py-6 text-center text-base text-slate-700">
              Try a lesson name, a phrase from a video, or a member&apos;s name.
            </p>
          ) : null}

          {groups.length > 0 && !error ? (
            <div
              id={LISTBOX_ID}
              role="listbox"
              aria-label={searching ? "Search suggestions" : "Recently opened"}
              className={`transition-opacity duration-200 ${loading ? "opacity-60" : ""}`}
            >
              {groups.map((group) => (
                <div
                  key={group.id}
                  role="group"
                  aria-labelledby={group.label ? `search-group-${group.id}` : undefined}
                  aria-label={group.label ? undefined : "All results"}
                  className={`search-fade-in ${group.label ? "pt-2" : "mt-2 border-t border-slate-900/[0.06] pt-2"}`}
                >
                  {group.label ? (
                    <div className="flex items-baseline justify-between gap-3 px-3 pb-1 pt-1.5">
                      <p
                        id={`search-group-${group.id}`}
                        className="text-sm font-semibold text-slate-700"
                      >
                        {group.label}
                      </p>
                      {group.allHref && group.count && group.count > group.options.length ? (
                        <Link
                          href={group.allHref}
                          onClick={() => {
                            rememberSearchOrigin(prefix);
                            onClose();
                          }}
                          className="text-sm font-semibold text-sky-800 hover:text-sky-950"
                        >
                          See all {group.count}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                  {group.options.map((option) => {
                    const index = indexByKey.get(option.key) ?? -1;
                    const selected = index === chosen;
                    return (
                      <Link
                        key={option.key}
                        id={optionId(index)}
                        role="option"
                        aria-selected={selected}
                        tabIndex={-1}
                        href={option.href}
                        target={option.external ? "_blank" : undefined}
                        rel={option.external ? "noreferrer" : undefined}
                        onMouseMove={() => {
                          if (!selected) setActiveIndex(index);
                        }}
                        onClick={(e) => onOptionClick(option, e)}
                        className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 outline-none transition-colors aria-selected:bg-white/55 aria-selected:shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_4px_14px_-8px_rgb(5_30_54/0.25)]"
                      >
                        {option.leading}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-slate-900">
                            {option.title}
                          </span>
                          {option.meta ? (
                            <span className="block truncate text-sm text-slate-700">
                              {option.meta}
                            </span>
                          ) : null}
                        </span>
                        {option.aside ? (
                          <span className="hidden shrink-0 text-sm tabular-nums text-slate-700 sm:block">
                            {option.aside}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
