import type { MetadataRoute } from "next";
import { BEYONDLEAN_DOMAIN } from "@/components/beyondlean/data";
import { getCaseStudies, getPublishedPosts } from "@/lib/beyondlean/content";

/**
 * Paul's sitemap. On beyondlean.com it's served at /sitemap.xml (next.config.ts); before the switch-over it lists
 * nothing, since the preview pages are noindex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!BEYONDLEAN_DOMAIN) return [];
  const base = `https://${BEYONDLEAN_DOMAIN}`;
  const pages = ["", "/about", "/how-it-works", "/constraint-call", "/case-studies", "/blog"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.8 })),
    ...getCaseStudies().map((c) => ({ url: `${base}/case-studies/${c.slug}`, priority: 0.7 })),
    ...getPublishedPosts().map((p) => ({ url: `${base}/blog/${p.slug}`, priority: 0.6 })),
  ];
}
