"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import {
  ARTICLE_STATUSES,
  staticLiveSlugFor,
  type Article,
  type ArticleStatus,
} from "@/lib/articles";
import { supabaseClient } from "@/lib/supabaseClient";

const STATUS_STYLES: Record<ArticleStatus, string> = {
  live: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-600",
  review: "bg-amber-100 text-amber-800",
  flagged: "bg-rose-100 text-rose-700",
  archive: "bg-slate-100 text-slate-400",
};

export default function AdminBlogPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/articles", { headers });
    if (!res.ok) {
      setError("Could not load articles.");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { articles?: Article[] };
    setArticles(body.articles ?? []);
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(slug: string, status: ArticleStatus) {
    const headers = await authHeaders();
    if (!headers) return;
    setArticles((prev) =>
      prev.map((a) =>
        a.slug === slug
          ? { ...a, editorial_status: status, published: status === "live" }
          : a
      )
    );
    await fetch(`/api/admin/articles/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ editorial_status: status }),
    });
    await load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.slug.includes(q) ||
        a.categories.some((c) => c.toLowerCase().includes(q))
    );
  }, [articles, search]);

  const withStatic = filtered.filter((a) => staticLiveSlugFor(a.slug));
  const unpublishedOnly = filtered.filter((a) => !staticLiveSlugFor(a.slug));

  const row = (a: Article) => {
    const staticSlug = staticLiveSlugFor(a.slug);
    return (
      <li
        key={a.id}
        className="flex flex-wrap items-center gap-2 px-4 py-2.5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {a.title}
          </p>
          <p className="truncate text-xs text-slate-400">
            {a.slug}
            {a.categories.length ? ` · ${a.categories.join(", ")}` : ""}
          </p>
        </div>
        {staticSlug ? (
          <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
            Static page live
          </span>
        ) : null}
        <select
          value={a.editorial_status}
          onChange={(e) => void setStatus(a.slug, e.target.value as ArticleStatus)}
          className={`shrink-0 rounded-full border-0 px-2 py-1 text-[11px] font-semibold focus:outline-none ${STATUS_STYLES[a.editorial_status]}`}
        >
          {ARTICLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Link
          href={`/preview/blog-post/${encodeURIComponent(a.slug)}`}
          target="_blank"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </Link>
        {staticSlug ? (
          <a
            href={`/blog/${staticSlug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Live page
          </a>
        ) : null}
      </li>
    );
  };

  return (
    <div className="w-full">
      <StickyPageHeader
        title="Blog"
        description="Imported from Drive (Content Marketer → Blog). Setting a post to 'live' publishes it on /blog. 'Static page live' rows already exist as hand-built pages, which take precedence over the DB copy."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts…"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
        />
        <span className="text-xs font-medium text-slate-400">
          {unpublishedOnly.length} awaiting review · {withStatic.length} with a
          live static page
        </span>
      </div>

      {error ? (
        <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <p className="py-10 text-sm text-slate-500">Loading posts…</p>
      ) : (
        <div className="mt-4 flex flex-col gap-5 pb-10">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">
              Not yet published ({unpublishedOnly.length})
            </h2>
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {unpublishedOnly.map(row)}
              {unpublishedOnly.length === 0 ? (
                <li className="px-4 py-4 text-sm text-slate-400">None.</li>
              ) : null}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-900">
              Already live as static pages ({withStatic.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              The DB copy here is the reviewable source; visitors see the
              static page. Compare with Preview vs Live page.
            </p>
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {withStatic.map(row)}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
