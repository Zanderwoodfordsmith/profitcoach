"use client";

import { useState } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { PostCard, topicIcon, type PostCardData } from "./PostCard";

/** Articles shown before "Show more": three rows of three. */
const PAGE = 9;

/** "All articles" with topic tabs that filter the grid, as on the BCA blog. Nine at a time, then "Show more". */
export function BlogFilter({ posts, topics, base }: { posts: PostCardData[]; topics: string[]; base: string }) {
  const [active, setActive] = useState("All");
  const [shown, setShown] = useState(PAGE);
  const matching = active === "All" ? posts : posts.filter((p) => p.category === active);
  const visible = matching.slice(0, shown);
  const left = matching.length - visible.length;
  const tabs = ["All", ...topics.filter((t) => posts.some((p) => p.category === t))];

  return (
    <section className="v5-section v5-white v5-blog-all" id="articles" aria-labelledby="v5-all-title">
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
                <button key={t} type="button" aria-pressed={active === t} onClick={() => {
                    setActive(t);
                    setShown(PAGE);
                  }}>
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
        {left > 0 && (
          <div className="v5-more-row">
            <button type="button" className="v5-more-btn" onClick={() => setShown((n) => n + PAGE)}>
              Show More Articles <span className="v5-tab-count">{left}</span>
              <ChevronDown aria-hidden />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
