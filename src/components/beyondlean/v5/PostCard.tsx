import Link from "next/link";
import { ArrowRight, BookOpen, TrendingUp, Users, Workflow, Wrench, type LucideIcon } from "lucide-react";

/** Blog topics, each with its icon and cover colour. Shared by the filter tabs and the card covers. */
export const TOPICS: Record<string, { icon: LucideIcon; tone: string }> = {
  "Leadership and culture": { icon: Users, tone: "navy" },
  Operations: { icon: Workflow, tone: "blue" },
  "Improvement tools": { icon: Wrench, tone: "teal" },
  "Strategy and growth": { icon: TrendingUp, tone: "sky" },
};

export const topicIcon = (category: string) => TOPICS[category]?.icon ?? BookOpen;

export type PostCardData = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readMinutes: string;
};

/** BCA-style cover: the topic's colour, its icon large in the corner and the topic name. */
export function PostCover({ category }: { category: string }) {
  const Icon = topicIcon(category);
  return (
    <div className={`v5-cover is-${TOPICS[category]?.tone ?? "navy"}`} aria-hidden>
      <Icon className="v5-cover-mark" strokeWidth={1.25} />
      <span className="v5-cover-label">
        <Icon />
        {category}
      </span>
    </div>
  );
}

export function PostCard({ post, href }: { post: PostCardData; href: string }) {
  return (
    <Link className="v5-article has-cover" href={href}>
      <PostCover category={post.category} />
      <div className="v5-article-body">
        {post.readMinutes && <span className="v5-post-meta">{post.readMinutes} min read</span>}
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <span className="v5-article-more">
          Read the article <ArrowRight aria-hidden />
        </span>
      </div>
    </Link>
  );
}
