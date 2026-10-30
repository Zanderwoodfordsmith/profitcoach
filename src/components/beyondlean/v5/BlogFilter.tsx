"use client";

import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { PostCard, topicIcon, type PostCardData } from "./PostCard";

/** "All articles" with topic tabs that filter the grid, as on the BCA blog. */
export function BlogFilter({ posts, topics, base }: { posts: PostCardData[]; topics: string[]; base: string }) {
  const [active, setActive] = useState("All");
  const visible = active === "All" ? posts : posts.filter((p) => p.category === active);
  const tabs = ["All", ...topics.filter((t) => posts.some((p) => p.category === t))];

  return (
    <section className="v5-section v5-white" id="articles" aria-labelledby="v5-all-title">
      <div className="v5-wrap">
        <div className="v5-head v5-all-head">
          <h2 id="v5-all-title" className="v5-h2">
            <span>All</span> <strong>articles.</strong>
          </h2>
          <div className="v5-tabs" role="group" aria-label="Filter by topic">
            {tabs.map((t) => {
              const Icon = t === "All" ? LayoutGrid : topicIcon(t);
              const count = t === "All" ? posts.length : posts.filter((p) => p.category === t).length;
              return (
                <button key={t} type="button" aria-pressed={active === t} onClick={() => setActive(t)}>
                  <Icon aria-hidden />
                  {t}
                  <span className="v5-tab-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="v5-posts" aria-live="polite">
          {visible.map((p) => (
            <PostCard key={p.slug} post={p} href={`${base}/${p.slug}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
