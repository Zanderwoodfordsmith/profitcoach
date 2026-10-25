"use client";

import { useEffect, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Copy,
  Download,
  PlayCircle,
} from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import {
  driveFileUrl,
  sheetCopyUrl,
  sheetUrl,
  slidesUrl,
  type ResourceBlock,
  type ResourceGroup,
  type ResourcePage,
} from "@/lib/resources/library";
import { toYouTubeEmbedUrl } from "@/lib/videoEmbed";
import { useRecordRecentVisit } from "@/lib/search/recentVisits";

import { ALL_PAGES, KindTile } from "./librarySearch";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

type Loaded = {
  page: ResourcePage;
  group: ResourceGroup;
  /** Markdown for the page's doc blocks, keyed by file. */
  docs: Record<string, string>;
};

type BlockOf<T extends ResourceBlock["type"]> = Extract<ResourceBlock, { type: T }>;

const FILE_LABEL: Record<BlockOf<"file">["format"], string> = {
  pptx: "PowerPoint",
  xlsx: "Excel",
  docx: "Word",
  key: "Keynote",
};

/** Blueprint buttons: navy for the main action, white for the rest. */
const PRIMARY = buttonClass("main", "small", "shrink-0");
const SECONDARY = buttonClass("second", "small", "shrink-0");
/** Content sits on solid white so long text stays crisp; the shadow matches the Blueprint's cards. */
const CARD = cardClass("plain");
const H2 = "text-title font-semibold text-[var(--bp-ink)]";
const LINK =
  "font-medium text-[var(--bp-blue)] underline decoration-[#0c5290]/30 underline-offset-[3px] hover:decoration-[#0c5290]";

function formatUpdated(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function videoEmbedUrl(url: string): string | null {
  if (/ted\.com\/talks\//.test(url)) return url.replace(/^https:\/\/(www\.)?ted\.com/, "https://embed.ted.com").split("?")[0];
  return toYouTubeEmbedUrl(url);
}

/**
 * One resource page. The page sends only the slug; the blocks (sheet, deck and
 * file links) and the document text load for a signed-in member.
 */
export function ResourceReader({ slug }: { slug: string }) {
  const { impersonatingCoachId } = useImpersonation();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (cancelled) return;
      const res = headers ? await fetch(`/api/academy/resources?slug=${encodeURIComponent(slug)}`, { headers }).catch(() => null) : null;
      const body = (await res?.json().catch(() => null)) as Loaded | null;
      if (cancelled) return;
      if (res?.ok && body?.page) setLoaded(body);
      else setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, impersonatingCoachId]);

  if (loaded) return <ResourceReaderPage slug={slug} found={loaded} docs={loaded.docs} />;
  return (
    <div className="px-1 py-10 text-sm text-[var(--bp-muted,#5b6b80)]" aria-live="polite">
      {failed ? "This resource didn't load. Sign in again, or refresh the page." : "Loading…"}
    </div>
  );
}

/** One resource page, headed the way Blueprint pages are: the title, one line, then the content. */
function ResourceReaderPage({ slug, found, docs }: { slug: string; found: Loaded; docs: Record<string, string> }) {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const base = `${prefix}/academy/resources`;
  useRecordRecentVisit(
    found ? { kind: "resource", title: found.page.title, detail: found.group.title } : null
  );
  if (!found) return null;
  const { page } = found;
  // Previous and next run through the whole library, so a coach can read straight through.
  const index = ALL_PAGES.findIndex((p) => p.slug === slug);
  const prev = index > 0 ? ALL_PAGES[index - 1] : null;
  const next = index < ALL_PAGES.length - 1 ? ALL_PAGES[index + 1] : null;
  const hrefFor = (p: ResourcePage) => `${base}/${p.slug}`;
  // Lesson links are written for coaches; admins stay on their own side of the app.
  const appHref = (href: string) => (href.startsWith("/coach/") ? href.replace(/^\/coach\//, `${prefix}/`) : href);
  const hasDoc = page.blocks.some((b) => b.type === "doc");

  function downloadPdf() {
    const previous = document.title;
    document.title = page.title;
    window.print();
    document.title = previous;
  }

  const md: Components = {
    h2: ({ children }) => <h2 className={`${H2} mt-12 first:mt-0`}>{children}</h2>,
    h3: ({ children }) => <h3 className="mt-9 text-subhead font-semibold text-[var(--bp-ink)] first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="mt-7 font-semibold text-[var(--bp-ink)] first:mt-0">{children}</h4>,
    p: ({ children }) => <p className="mt-4 max-w-[70ch] first:mt-0">{children}</p>,
    ul: ({ children }) => <ul className="mt-3 max-w-[70ch] list-disc space-y-1.5 pl-6 marker:text-[var(--bp-sky)] [&_ul]:mt-1.5">{children}</ul>,
    ol: ({ children }) => <ol className="mt-3 max-w-[70ch] list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-[var(--bp-blue)]">{children}</ol>,
    strong: ({ children }) => <strong className="font-medium text-[var(--bp-ink)]">{children}</strong>,
    hr: () => <hr className="my-10 border-[var(--bp-rule)]" />,
    // eslint-disable-next-line @next/next/no-img-element
    img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" className={`rs-keep my-6 w-full ${CARD}`} />,
    a: ({ href = "", children }: ComponentPropsWithoutRef<"a">) => {
      if (/^https?:/.test(href)) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {children}
            <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5 align-[-0.1em] opacity-60" aria-hidden />
          </a>
        );
      }
      return (
        <Link href={href.startsWith("/") ? appHref(href) : `${base}/${href}`} className={LINK}>
          {children}
        </Link>
      );
    },
    table: ({ children }) => (
      <div className={`rs-keep mt-6 overflow-x-auto ${CARD}`}>
        <table className="w-full min-w-[40rem] border-collapse text-left text-ui leading-relaxed">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-[var(--bp-rule)] bg-[var(--bp-tint)] px-4 py-3 align-bottom text-sm font-semibold text-[var(--bp-ink)]">{children}</th>
    ),
    td: ({ children }) => <td className="border-b border-[var(--bp-rule)] px-4 py-3 align-top">{children}</td>,
  };

  function renderBlock(block: ResourceBlock, key: number) {
    switch (block.type) {
      case "doc": {
        const markdown = docs[block.file] ?? "";
        if (!markdown.trim()) return null;
        return (
          <div key={key} className="text-read leading-[1.7]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={md}>
              {markdown}
            </ReactMarkdown>
          </div>
        );
      }
      case "sheet":
        return <SheetBlock key={key} block={block} hrefForSlug={(s) => `${base}/${s}`} />;
      case "slides":
        return <SlidesBlock key={key} block={block} />;
      case "file":
        return <FileBlock key={key} block={block} />;
      case "video":
        return <VideoBlock key={key} block={block} />;
      case "image":
        return (
          <figure key={key} className="rs-keep space-y-2.5">
            <a href={block.src} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.src} alt={block.title} loading="lazy" className={`w-full ${CARD}`} />
            </a>
            <figcaption className="text-sm text-[var(--bp-muted)]">{block.title}</figcaption>
          </figure>
        );
      case "links":
        return <LinksBlock key={key} block={block} hrefForSlug={(s) => `${base}/${s}`} />;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[54rem] px-5 pb-12 pt-8 md:px-10 md:pt-10 print:p-0">
      <header className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <h1 className="min-w-0 flex-1 text-heading font-semibold text-[#0f172a]">{page.title}</h1>
          <div className="rs-no-print flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
            {page.lesson ? (
              <Link href={appHref(page.lesson)} className={SECONDARY}>
                <PlayCircle className="h-4 w-4" aria-hidden />
                Watch the lesson
              </Link>
            ) : null}
            {hasDoc ? (
              <button type="button" onClick={downloadPdf} className={PRIMARY}>
                <Download className="h-4 w-4" aria-hidden />
                Download PDF
              </button>
            ) : null}
          </div>
        </div>
        {page.dek ? <p className="mt-2.5 max-w-[62ch] text-lg leading-[1.55] text-[#475569]">{page.dek}</p> : null}
        {page.updated ? <p className="mt-2 text-sm text-[var(--bp-faint)]">Updated {formatUpdated(page.updated)}</p> : null}
      </header>

      <div className="space-y-10 pt-8">
        {page.blocks.map(renderBlock)}
      </div>

      <nav aria-label="Previous and next" className="rs-no-print mt-14 grid gap-3 border-t border-[var(--bp-rule)] pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={hrefFor(prev)} className="rounded-xl px-4 py-3 transition-colors hover:bg-white/70">
            <span className="block text-xs font-medium text-[var(--bp-faint)]">Previous</span>
            <span className="mt-0.5 block font-medium text-[var(--bp-ink)]">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={hrefFor(next)} className="rounded-xl px-4 py-3 text-right transition-colors hover:bg-white/70">
            <span className="block text-xs font-medium text-[var(--bp-faint)]">Next</span>
            <span className="mt-0.5 block font-medium text-[var(--bp-ink)]">{next.title}</span>
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

/** Title row shared by sheets, decks and files: what it is, then what you can do with it. */
function AssetHeader({ type, title, meta, children }: { type: ResourceBlock["type"]; title: string; meta: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <KindTile type={type} />
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-[var(--bp-ink)]">{title}</p>
          <p className="text-sm text-[var(--bp-muted)]">{meta}</p>
        </div>
      </div>
      <div className="rs-no-print flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SheetBlock({ block, hrefForSlug }: { block: BlockOf<"sheet">; hrefForSlug: (slug: string) => string }) {
  const tabCount = block.tabGroups.reduce((n, g) => n + g.tabs.length, 0);
  return (
    <section className="space-y-8">
      <div className={CARD}>
        <AssetHeader type="sheet" title={block.title} meta={`Google Sheet · ${tabCount} ${tabCount === 1 ? "tab" : "tabs"}`}>
          <a href={sheetCopyUrl(block.id)} target="_blank" rel="noopener noreferrer" className={PRIMARY}>
            <Copy className="h-4 w-4" aria-hidden />
            Make a copy
          </a>
          <a href={sheetUrl(block.id)} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
            View the master
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </AssetHeader>
        <p className="border-t border-[var(--bp-rule)] px-5 py-3 text-sm leading-relaxed text-[var(--bp-muted)]">
          Make a copy for each client. Their copy keeps every tab and formula, and the master stays clean.
          {block.note ? <span className="block">{block.note}</span> : null}
        </p>
      </div>

      {block.tabGroups.map((group, i) => (
        <div key={group.label || i} className="space-y-3">
          {group.label ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className={H2}>{group.label}</h2>
              {group.page ? (
                <Link href={hrefForSlug(group.page)} className="rs-no-print inline-flex items-center gap-1 text-sm font-medium text-[var(--bp-blue)] hover:text-[var(--bp-navy)]">
                  How to run it
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : (
            <h2 className={H2}>{tabCount === 1 ? "The tab" : "The tabs"}</h2>
          )}
          <ul className={`divide-y divide-[var(--bp-rule)] overflow-hidden ${CARD}`}>
            {group.tabs.map((tab) => (
              <li key={tab.gid} className="rs-keep px-5 py-3.5">
                <a href={sheetUrl(block.id, tab.gid)} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--bp-ink)] hover:text-[var(--bp-blue)]">
                  {tab.title}
                  <ArrowUpRight className="ml-1 inline h-4 w-4 align-[-0.15em] text-[var(--bp-faint)]" aria-hidden />
                </a>
                <p className="mt-0.5 leading-relaxed text-[var(--bp-muted)]">{tab.about}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function SlidesBlock({ block }: { block: BlockOf<"slides"> }) {
  return (
    <section className={`overflow-hidden ${CARD}`}>
      <AssetHeader type="slides" title={block.title} meta={`Google Slides · ${block.slides} slides`}>
        <a href={slidesUrl(block.id, "copy")} target="_blank" rel="noopener noreferrer" className={PRIMARY}>
          <Copy className="h-4 w-4" aria-hidden />
          Make a copy
        </a>
        <a href={slidesUrl(block.id, "edit")} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
          Open
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </AssetHeader>
      <div className="rs-no-print aspect-video border-t border-[var(--bp-rule)] bg-[var(--bp-tint)]">
        <iframe src={slidesUrl(block.id, "embed")} title={block.title} className="h-full w-full" loading="lazy" allowFullScreen />
      </div>
    </section>
  );
}

function FileBlock({ block }: { block: BlockOf<"file"> }) {
  // Drive can show Office files in the page; Keynote it can only download.
  const preview = block.format !== "key";
  return (
    <section className={`overflow-hidden ${CARD}`}>
      <AssetHeader type="file" title={block.title} meta={`${FILE_LABEL[block.format]} file`}>
        <a href={driveFileUrl(block.id, "download")} className={PRIMARY}>
          <Download className="h-4 w-4" aria-hidden />
          Download
        </a>
        <a href={driveFileUrl(block.id, "view")} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
          Open in Drive
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </AssetHeader>
      {preview ? (
        <div className={`rs-no-print border-t border-[var(--bp-rule)] bg-[var(--bp-tint)] ${block.format === "pptx" ? "aspect-video" : "h-[34rem]"}`}>
          <iframe src={driveFileUrl(block.id, "preview")} title={block.title} className="h-full w-full" loading="lazy" allowFullScreen />
        </div>
      ) : null}
    </section>
  );
}

function VideoBlock({ block }: { block: BlockOf<"video"> }) {
  const src = videoEmbedUrl(block.url);
  return (
    <section className="rs-no-print space-y-3">
      <h2 className={H2}>{block.title}</h2>
      {src ? (
        <div className={`aspect-video overflow-hidden bg-[var(--bp-navy)] ${CARD}`}>
          <iframe
            src={src}
            title={block.title}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <a href={block.url} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
          Watch the video
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      )}
    </section>
  );
}

function LinksBlock({ block, hrefForSlug }: { block: BlockOf<"links">; hrefForSlug: (slug: string) => string }) {
  return (
    <section className="space-y-3">
      {block.title ? <h2 className={H2}>{block.title}</h2> : null}
      <ul className={`divide-y divide-[var(--bp-rule)] overflow-hidden ${CARD}`}>
        {block.links.map((link) => {
          const external = /^https?:/.test(link.url);
          const titleClass = `font-medium hover:text-[var(--bp-blue)] ${link.broken ? "text-[var(--bp-muted)] line-through decoration-[var(--bp-faint)]" : "text-[var(--bp-ink)]"}`;
          return (
            <li key={link.url} className="rs-keep px-5 py-3.5">
              {external ? (
                <a href={link.url} target="_blank" rel="noopener noreferrer" className={titleClass}>
                  {link.title}
                  <ArrowUpRight className="ml-1 inline h-4 w-4 align-[-0.15em] text-[var(--bp-faint)]" aria-hidden />
                </a>
              ) : (
                <Link href={hrefForSlug(link.url)} className={titleClass}>
                  {link.title}
                </Link>
              )}
              <p className="mt-0.5 text-sm text-[var(--bp-muted)]">{external ? hostname(link.url) : "In Resources"}</p>
              {link.note ? (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-[#8a4b08]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {link.note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
