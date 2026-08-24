"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { ArticleView } from "@/components/blog/ArticleView";
import type { Article } from "@/lib/articles";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Admin-only preview of a blog article exactly as it renders on /blog —
 * works for unpublished posts (fetches via the admin API).
 */
export default function BlogPostPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/admin/articles", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { articles?: Article[] };
    setArticle((body.articles ?? []).find((a) => a.slug === slug) ?? null);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="p-10 text-sm text-slate-500">Loading preview…</p>
    );
  }
  if (!article) {
    return (
      <p className="p-10 text-sm text-slate-500">
        Post not found (or you are not signed in as an admin).{" "}
        <Link href="/admin/blog" className="text-sky-700 underline">
          Back to Blog admin
        </Link>
      </p>
    );
  }

  return (
    <ArticleView
      article={article}
      banner={
        <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">
          Admin preview — {article.published ? "live" : "not published"} ·{" "}
          {article.editorial_status}
          <Link href="/admin/blog" className="underline">
            Back to Blog admin
          </Link>
        </div>
      }
    />
  );
}
