import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

/** Blog posts and case studies are Markdown files with simple `key: "value"` frontmatter. */
type Doc = { meta: Record<string, string>; body: string };

const ROOT = path.join(process.cwd(), "content", "beyondlean");

function parse(raw: string): Doc {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([A-Za-z]+):\s*"?(.*?)"?\s*$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, body: match[2].trim() };
}

function readDir(dir: string): Doc[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => parse(fs.readFileSync(path.join(full, f), "utf8")));
}

export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  date: string;
  source: string;
  readMinutes: string;
  image: string;
  featured: boolean;
  body: string;
};

export type CaseStudy = {
  slug: string;
  title: string;
  client: string;
  sector: string;
  status: string;
  figure: string;
  figureLabel: string;
  summary: string;
  timeframe: string;
  photo: string;
  order: number;
  confirm: string;
  body: string;
};

export const BLOG_CATEGORIES = ["Leadership and culture", "Operations", "Improvement tools", "Strategy and growth"];

export const getPosts = cache((): BlogPost[] =>
  readDir("blog")
    .filter((d) => d.meta.slug && d.meta.title)
    .map(({ meta, body }) => ({
      slug: meta.slug,
      title: meta.title,
      category: meta.category || "Operations",
      excerpt: meta.excerpt || "",
      date: meta.date || "",
      source: meta.source || "",
      readMinutes: meta.readMinutes || "",
      image: meta.image || "",
      featured: meta.featured === "yes",
      body,
    }))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title))
);

/**
 * Phase 1 carries every useful article across (lightly tidied) so nothing is lost when the domain
 * switches; the featured few lead the blog. Optimising them is Phase 2.
 */
export const getPublishedPosts = getPosts;

export const getPost = (slug: string) => getPublishedPosts().find((p) => p.slug === slug) ?? null;

export const getCaseStudies = cache((): CaseStudy[] =>
  readDir("case-studies")
    .filter((d) => d.meta.slug && d.meta.title)
    .map(({ meta, body }) => ({
      slug: meta.slug,
      title: meta.title,
      client: meta.client || "",
      sector: meta.sector || "",
      status: meta.status || "",
      figure: meta.figure || "",
      figureLabel: meta.figureLabel || "",
      summary: meta.summary || "",
      timeframe: meta.timeframe || "",
      photo: meta.photo || "",
      order: Number(meta.order) || 99,
      confirm: meta.confirm || "",
      body,
    }))
    .sort((a, b) => a.order - b.order)
);

export const getCaseStudy = (slug: string) => getCaseStudies().find((c) => c.slug === slug) ?? null;

/** Splits a case study body into its H2 sections, keyed by heading. */
export function sections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = body.split(/^## /m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return out;
}
