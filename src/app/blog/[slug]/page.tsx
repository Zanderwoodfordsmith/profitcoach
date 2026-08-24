import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleView } from "@/components/blog/ArticleView";
import type { Article } from "@/lib/articles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getPublishedArticle(slug: string): Promise<Article | null> {
  const { data } = await supabaseAdmin
    .from("articles")
    .select(
      "id, slug, title, excerpt, body, published, published_at, editorial_status, categories, created_at, updated_at"
    )
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return (data as Article | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Blog — The Profit Coach" };
  return {
    title: `${article.title} — The Profit Coach`,
    description: article.excerpt,
  };
}

export default async function BlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ coach?: string }>;
}) {
  const { slug } = await params;
  const { coach } = await searchParams;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();
  return <ArticleView article={article} coachSlug={coach} />;
}
