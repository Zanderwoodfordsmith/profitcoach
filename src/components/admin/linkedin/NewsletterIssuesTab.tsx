"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Copy, LayoutGrid, List, Loader2, Newspaper, RefreshCw, X } from "lucide-react";
import { Blocks } from "@/components/practice/document/Blocks";
import "@/components/practice/document/blueprint.css";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";
import type { LinkedInHistoryPayload, NewsletterDraftItem, NewsletterIssueItem } from "@/lib/linkedinHistory/loadHistory";
import { daysAgoLabel } from "./useLinkedInHistory";

const CADENCE: Record<string, string> = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function reach(issue: Pick<NewsletterIssueItem, "impressions" | "reactions" | "comments">): string {
  const parts = [
    issue.impressions ? `${issue.impressions.toLocaleString("en-GB")} views` : null,
    `${issue.reactions} reactions`,
    issue.comments ? `${issue.comments} comments` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** The banner on a draft, or an issue whose cover didn't come through. */
function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex aspect-video w-full items-end bg-[linear-gradient(150deg,#051e36_0%,#0c5290_60%,#1a8fd4_100%)] p-4">
      <p className="line-clamp-3 text-base font-semibold leading-snug text-white">{title}</p>
    </div>
  );
}

function IssueCard({
  cover,
  title,
  eyebrow,
  meta,
  badge,
  onOpen,
}: {
  cover: string | null;
  title: string;
  eyebrow: string;
  meta: string;
  badge?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cardClass("raised", "group flex flex-col overflow-hidden text-left transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A66C2]")}
    >
      <div className="relative w-full overflow-hidden bg-slate-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
        ) : (
          <CoverPlaceholder title={title} />
        )}
        {badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-caption font-semibold text-slate-800 shadow-sm">{badge}</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-medium text-slate-500">{eyebrow}</p>
        <p className="line-clamp-2 text-ui font-semibold leading-snug text-slate-900">{title}</p>
        <p className="mt-auto pt-1 text-xs tabular-nums text-slate-500">{meta}</p>
      </div>
    </button>
  );
}

/** One issue as a list row: small cover, title, date, where it stands. */
function IssueRow({
  cover,
  title,
  date,
  meta,
  badge,
  onOpen,
}: {
  cover: string | null;
  title: string;
  date: string;
  meta: string;
  badge?: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0A66C2] sm:px-5"
      >
        <span className="relative hidden aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:block">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 bg-gradient-to-br from-[#0b4d88] to-[#1a8fd4]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-semibold text-slate-900">{title}</span>
          <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
            {date}
            {meta ? ` · ${meta}` : ""}
          </span>
        </span>
        <span
          className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${
            badge ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
          }`}
        >
          {badge ?? "Published"}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500" aria-hidden />
      </button>
    </li>
  );
}

const VIEW_KEY = "newsletter-issues-view";

type Opened = { kind: "issue"; issue: NewsletterIssueItem } | { kind: "draft"; draft: NewsletterDraftItem };

function Reader({
  opened,
  getHeaders,
  onClose,
}: {
  opened: Opened;
  getHeaders: () => Promise<Record<string, string> | null>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [blocks, setBlocks] = useState<BlueprintBlock[] | null>(opened.kind === "draft" ? opened.draft.blocks : null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (opened.kind !== "issue") return;
    let cancelled = false;
    void (async () => {
      try {
        const headers = await getHeaders();
        if (!headers) throw new Error();
        const res = await fetch(`/api/linkedin/history/issues/${encodeURIComponent(opened.issue.id)}`, { headers });
        const body = (await res.json().catch(() => ({}))) as { blocks?: BlueprintBlock[] | null };
        if (!cancelled) {
          if (body.blocks?.length) setBlocks(body.blocks);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opened, getHeaders]);

  const title = opened.kind === "issue" ? opened.issue.title : opened.draft.title;
  const topic = opened.kind === "issue" && opened.issue.topic && opened.issue.topic !== opened.issue.title ? opened.issue.topic : null;
  const cover = opened.kind === "issue" ? opened.issue.cover_url : null;
  const post = opened.kind === "draft" ? opened.draft.post : null;

  async function copy() {
    if (!blocks) return;
    try {
      await navigator.clipboard.writeText(blocksToMarkdown(blocks, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked; nothing to do
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-3 py-6 sm:px-6 sm:py-10"
      onClick={onClose}
    >
      <article className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <CoverPlaceholder title={title} />
        )}
        <div className="px-5 pb-10 pt-6 sm:px-10">
          <p className="text-xs font-medium text-slate-500">
            {opened.kind === "issue"
              ? [opened.issue.newsletter_name, formatDate(opened.issue.published_at)].filter(Boolean).join(" · ")
              : `Draft from BCA · written ${formatDate(opened.draft.written_at)}`}
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-900">{title}</h2>
          {topic ? <p className="mt-1.5 text-base text-slate-600">{topic}</p> : null}
          {opened.kind === "issue" ? <p className="mt-2 text-xs tabular-nums text-slate-500">{reach(opened.issue)}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {opened.kind === "issue" ? (
              <a
                href={opened.issue.url}
                target="_blank"
                rel="noreferrer"
                className={buttonClass("main", "small")}
              >
                Open on LinkedIn
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <button
              type="button"
              disabled={!blocks}
              onClick={() => void copy()}
              className={buttonClass("second", "small")}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy text"}
            </button>
          </div>

          <div className="bp-doc @container mt-8 border-t border-slate-100 pt-8">
            {blocks ? (
              <Blocks blocks={blocks} />
            ) : failed ? (
              <p className="text-sm text-slate-500">
                The full text isn&apos;t here yet. Open it on LinkedIn to read it.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading the issue…
              </p>
            )}
            {post ? (
              <section className={cardClass("soft", "mt-12 p-5")}>
                <h3 className="text-sm font-semibold text-slate-900">Post about this issue</h3>
                <p className="mt-0.5 text-xs text-slate-500">For the feed, so people open it.</p>
                <div className="mt-4">
                  <Blocks blocks={post} />
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

export function NewsletterIssuesTab({
  history,
  loading,
  importing,
  onImport,
  getHeaders,
  openIssueId,
  onOpenIssue,
  blueprintHref,
}: {
  history: LinkedInHistoryPayload | null;
  loading: boolean;
  importing: boolean;
  onImport: () => void;
  getHeaders: () => Promise<Record<string, string> | null>;
  /** An imported issue id, or "draft:" + Blueprint key. */
  openIssueId: string | null;
  onOpenIssue: (id: string | null) => void;
  /** Where the newsletter's name and call to action are set. Hidden when null. */
  blueprintHref: string | null;
}) {
  const issues = useMemo(() => history?.issues ?? [], [history]);
  // List rows by default; the cards stay one click away.
  const [view, setView] = useState<"list" | "cards">(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "list";
    } catch {
      return "list";
    }
  });
  const pickView = (next: "list" | "cards") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Remembering the choice is only a convenience.
    }
  };
  const drafts = useMemo(() => history?.drafts ?? [], [history]);

  const opened: Opened | null = useMemo(() => {
    if (!openIssueId) return null;
    if (openIssueId.startsWith("draft:")) {
      const draft = drafts.find((d) => `draft:${d.key}` === openIssueId);
      return draft ? { kind: "draft", draft } : null;
    }
    const issue = issues.find((i) => i.id === openIssueId);
    return issue ? { kind: "issue", issue } : null;
  }, [openIssueId, issues, drafts]);

  if (loading && !history) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your newsletter…
      </div>
    );
  }

  const settings = history?.newsletter;
  const name = settings?.name || issues.find((i) => i.newsletter_name)?.newsletter_name || "Your newsletter";
  const lastIssue = history?.summary.last_issue_days ?? null;
  const medianViews = median(issues.filter((i) => i.impressions > 0).slice(0, 12).map((i) => i.impressions));
  const facts = [
    settings?.audience ? `For ${settings.audience}` : null,
    settings?.cadence ? CADENCE[settings.cadence] ?? null : null,
    issues.length ? `${issues.length} ${issues.length === 1 ? "issue" : "issues"}` : null,
    issues.length ? `last one ${daysAgoLabel(lastIssue)}` : null,
    medianViews != null ? `usually ${medianViews.toLocaleString("en-GB")} views` : null,
  ].filter(Boolean);
  const neverImported = Boolean(history?.connected && !history.last_import?.last_ok_at);

  return (
    <div className="space-y-8">
      <header className={cardClass("plain", "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Newsletter</p>
            <h2 className="mt-1 text-subhead font-semibold text-slate-900">{name}</h2>
            {settings?.description ? <p className="mt-1 max-w-[60ch] text-sm text-slate-600">{settings.description}</p> : null}
            {facts.length ? <p className="mt-2 text-xs tabular-nums text-slate-500">{facts.join(" · ")}</p> : null}
          </div>
          {blueprintHref ? (
            <Link
              href={blueprintHref}
              className={buttonClass("second", "small", "shrink-0")}
            >
              Edit in Blueprint
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
        {settings?.cta ? (
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-700">
            <span className="text-slate-500">Every issue ends with: </span>
            {settings.cta}
          </p>
        ) : blueprintHref ? (
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
            The name, who it&apos;s for and the call to action aren&apos;t set yet.{" "}
            <Link href={blueprintHref} className="font-medium text-slate-700 underline-offset-2 hover:underline">
              Set them in your Blueprint
            </Link>
            .
          </p>
        ) : null}
        {history?.last_import?.last_ok_at ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span>Updated from LinkedIn {daysAgoLabel(history.last_import.days_since_ok)}</span>
            <button
              type="button"
              onClick={onImport}
              disabled={importing}
              className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${importing ? "animate-spin" : ""}`} />
              {importing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        ) : null}
      </header>

      {neverImported ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">Bring in your past issues</p>
            <p className="mt-0.5 text-sm text-slate-600">We read your posts and newsletter issues from LinkedIn. Nothing is posted. It takes a minute or two.</p>
          </div>
          <button
            type="button"
            onClick={onImport}
            disabled={importing}
            className={buttonClass("main")}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {importing ? "Importing…" : "Import from LinkedIn"}
          </button>
        </div>
      ) : null}

      {drafts.length || issues.length ? (
        <div className="-mb-2 flex justify-end">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5" role="group" aria-label="Show issues as">
            {(
              [
                ["list", "List", List],
                ["cards", "Cards", LayoutGrid],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => pickView(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  view === key ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {drafts.length && view === "list" ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Next up</h3>
          <ul className={cardClass("plain", "divide-y divide-slate-100 overflow-hidden")}>
            {drafts.map((draft) => (
              <IssueRow
                key={draft.key}
                cover={null}
                title={draft.title}
                date={`Written ${formatDate(draft.written_at)}`}
                meta={draft.post ? "Issue and feed post ready" : "Issue ready to review"}
                badge="Draft from BCA"
                onOpen={() => onOpenIssue(`draft:${draft.key}`)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {issues.length && view === "list" ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Published</h3>
          <ul className={cardClass("plain", "divide-y divide-slate-100 overflow-hidden")}>
            {issues.map((issue) => (
              <IssueRow
                key={issue.id}
                cover={issue.cover_url}
                title={issue.topic || issue.title}
                date={formatDate(issue.published_at)}
                meta={reach(issue)}
                onOpen={() => onOpenIssue(issue.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {drafts.length && view === "cards" ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Next up</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((draft) => (
              <IssueCard
                key={draft.key}
                cover={null}
                title={draft.title}
                eyebrow={`Written ${formatDate(draft.written_at)}`}
                meta={draft.post ? "Issue and feed post ready" : "Issue ready to review"}
                badge="Draft from BCA"
                onOpen={() => onOpenIssue(`draft:${draft.key}`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {issues.length && view === "cards" ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Published</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                cover={issue.cover_url}
                title={issue.topic || issue.title}
                eyebrow={formatDate(issue.published_at)}
                meta={reach(issue)}
                onOpen={() => onOpenIssue(issue.id)}
              />
            ))}
          </div>
        </section>
      ) : !issues.length && !neverImported && !drafts.length ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-800">No newsletter issues yet</p>
          <p className="mt-1 text-xs text-slate-500">Issues you publish on LinkedIn show up here, and so do the ones BCA writes for you.</p>
        </div>
      ) : null}

      {opened ? <Reader opened={opened} getHeaders={getHeaders} onClose={() => onOpenIssue(null)} /> : null}
    </div>
  );
}
