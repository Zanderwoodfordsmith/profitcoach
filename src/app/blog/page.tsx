import type { Metadata } from "next";

import {
  BLOG_CATEGORIES,
  staticLiveSlugFor,
  type Article,
  type BlogCategory,
  type BlogPost,
} from "@/lib/articles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { BlogContent } from "./BlogContent";

export const metadata: Metadata = {
  title: "Blog — The Profit Coach",
  description:
    "Insights for owners who want to simplify growth, increase profit, and build a business that works without constant firefighting.",
};

export const dynamic = "force-dynamic";

const CATEGORY_IMAGES: Record<BlogCategory, string> = {
  "Owner Performance": "/landing/v2/how-1.png",
  "Strategy & Planning": "/landing/v2/how-3.png",
  "Profit & Cash Flow": "/landing/v2/dashboard.png",
  "Revenue & Marketing": "/landing/v2/how-2.png",
  "Ops, Systems & Team": "/how-it-works/owner-pyramid.png",
};

function toBlogPost(article: Article): BlogPost {
  const category = (BLOG_CATEGORIES as readonly string[]).includes(
    article.categories[0] ?? ""
  )
    ? (article.categories[0] as BlogCategory)
    : "Strategy & Planning";
  const date = new Date(
    article.published_at ?? article.created_at
  ).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return {
    title: article.title,
    excerpt: article.excerpt,
    href: `/blog/${article.slug}`,
    category,
    date,
    image: CATEGORY_IMAGES[category],
  };
}

export default async function BlogPage() {
  const { data } = await supabaseAdmin
    .from("articles")
    .select(
      "id, slug, title, excerpt, body, published, published_at, editorial_status, categories, created_at, updated_at"
    )
    .eq("published", true)
    .order("published_at", { ascending: false });

  const dbPosts = ((data ?? []) as Article[])
    // Posts that already exist as hand-built static pages stay static.
    .filter((a) => !staticLiveSlugFor(a.slug))
    .map(toBlogPost);

  return <BlogContent dbPosts={dbPosts} />;
}
