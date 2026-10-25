"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Download, FileText, GraduationCap, Loader2, MessageCircle, Play, Printer, Square } from "lucide-react";

import {
  BLUEPRINT_GROUPS,
  BLUEPRINT_SECTIONS,
  buildOrder,
  stillNeeded,
  type BlueprintGroup,
  type BlueprintLink,
  type BlueprintSection,
  sectionKey,
} from "@/lib/practiceKnowledge/blueprint";
import { blueprintFileName, blueprintMarkdown } from "@/lib/practiceKnowledge/exportMarkdown";
import { workflowQueue } from "@/lib/practiceKnowledge/sectionWorkflow";

import { DecisionRecordView } from "../DecisionRecord";
import { usePractice } from "../PracticeProvider";
import { SectionView } from "./SectionView";
import { AvaHalo } from "@/components/ava/AvaHalo";

/** Pages that belong in the document (not the Command Center or the whole-document page). */
export function documentPages(group: BlueprintGroup): BlueprintLink[] {
  return group.pages.filter((p) => p.slug !== "blueprint" && (p.slug !== "command" || p.sections.length > 0));
}

export const DOCUMENT_GROUPS = BLUEPRINT_GROUPS.filter((g) => documentPages(g).length > 0);

export function useBlueprintProgress() {
  const { knowledge, payload, viewer } = usePractice();
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const build = buildOrder();
  const written = build.filter((k) => knowledge.built_sections[k]).length;
  const needed = stillNeeded(row);
  const queue = workflowQueue(row);
  const mine = viewer === "bca" ? "bca" : "coach";
  const yoursTodo = queue.filter((item) => item.work.status === "todo" && item.work.owner === mine).length;
  const yoursReview = queue.filter((item) => item.work.status === "review" && item.work.owner === mine).length;
  const done = queue.filter((item) => item.work.status === "done").length;
  return { written, toWrite: build.length, needed, yoursTodo, yoursReview, done, tracked: queue.length };
}

/** A small key to the two looks, so a coach knows what is theirs to fill and what BCA wrote. */
export function InputOutputKey() {
  return (
    <p className="bp-no-print flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[var(--bp-muted)]">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-5 rounded-[4px] border border-[#cdd8e4] bg-white" />
        You tell us
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-5 rounded-[4px] bg-[#e6eaf0]" />
        BCA writes it, you can edit it
      </span>
    </p>
  );
}

function ClassroomLinks({ page }: { page: BlueprintLink }) {
  const { href } = usePractice();
  if (!page.learn?.length) return null;
  return (
    <aside className="bp-keep rounded-2xl border border-[var(--bp-rule)] px-5 py-5">
      <p className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-[var(--bp-ink)]">
        <GraduationCap className="h-4 w-4 text-[var(--bp-sky)]" aria-hidden />
        How to do it, in the Classroom
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">The same for every coach, so it lives in one place and stays up to date.</p>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 @xl:grid-cols-2">
        {page.learn.map((link) => (
          <li key={link.href}>
            <Link
              href={href(link.href)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--bp-blue)] hover:underline"
            >
              {link.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** The page name is the title. The old headline leads the description, then the summary follows. */
export function PageBlurb({
  page,
  className,
}: {
  page: Pick<BlueprintLink, "heading" | "summary">;
  className?: string;
}) {
  const heading = page.heading.trim();
  const lead = heading && !/[.!?]$/.test(heading) ? `${heading}.` : heading;
  if (!lead && !page.summary) return null;
  return (
    <p className={className}>
      {lead ? <strong className="font-semibold">{lead}</strong> : null}
      {lead && page.summary ? " " : null}
      {page.summary}
    </p>
  );
}

function sectionRefFor(page: BlueprintLink, section: BlueprintSection) {
  return {
    group: BLUEPRINT_GROUPS.find((g) => g.pages.includes(page))!,
    page,
    section,
    key: sectionKey(page, section),
  };
}

export function PageView({ page, showTitle = true }: { page: BlueprintLink; showTitle?: boolean }) {
  return (
    <div id={`p-${page.slug}`} className="scroll-mt-20">
      {showTitle ? (
        <header className="bp-keep mb-8">
          <h2 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] text-[var(--bp-ink)] @2xl:text-[1.875rem]">
            {page.title}
          </h2>
          <PageBlurb page={page} className="mt-2 max-w-[60ch] text-[1.0625rem] leading-[1.6] text-[var(--bp-muted)]" />
        </header>
      ) : null}
      {page.slug === "decisions" ? (
        <DecisionRecordView />
      ) : (
        <div className="space-y-5">
          {page.sections
            .filter((section) => section.face !== "stored")
            .map((section) => (
              <SectionView key={section.id} sectionRef={sectionRefFor(page, section)} />
            ))}
          <ClassroomLinks page={page} />
        </div>
      )}
    </div>
  );
}

export function ChapterView({ group, index }: { group: BlueprintGroup; index: number }) {
  return (
    <section id={`c-${index + 1}`} className="bp-chapter scroll-mt-16 pt-20 first:pt-12">
      <header className="bp-keep mb-12">
        <h1 className="bp-display text-[2.5rem] font-medium leading-[1.05] tracking-[-0.03em] text-[var(--bp-navy)] @2xl:text-[3.25rem]">
          <span className="font-normal italic text-[var(--bp-sky)]">{index + 1}.</span> {group.label}
        </h1>
        <div className="bp-rule mt-5 max-w-md" />
        <p className="mt-4 max-w-[55ch] text-[1.0625rem] leading-[1.6] text-[var(--bp-muted)]">{group.intro}</p>
      </header>
      <div className="space-y-20">
        {documentPages(group).map((page) => (
          <PageView key={page.slug} page={page} />
        ))}
      </div>
    </section>
  );
}

export function BuildBar({ compact = false }: { compact?: boolean }) {
  const { building, buildAll, stopBuild, knowledge } = usePractice();
  const progress = useBlueprintProgress();
  if (!progress || !knowledge) return null;
  const running = building.active.length > 0;
  const pct = building.total ? Math.round((building.done / building.total) * 100) : 0;
  const allWritten = progress.written === progress.toWrite;
  const current = building.active[0]
    ? BLUEPRINT_SECTIONS.find((r) => r.key === building.active[0])?.section.title
    : null;

  if (running) {
    return (
      <div className="bp-no-print rounded-2xl border border-[var(--bp-rule)] bg-white px-5 py-4 shadow-[0_12px_30px_-24px_rgba(5,30,54,0.5)]" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--bp-ink)]">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--bp-sky)]" aria-hidden />
            <span className="truncate">Writing {current ?? "your blueprint"}</span>
          </p>
          <span className="flex shrink-0 items-center gap-3">
            <span className="bp-num text-xs text-[var(--bp-muted)]">
              {building.done} of {building.total}
            </span>
            <button
              type="button"
              onClick={stopBuild}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)]"
            >
              <Square className="h-3 w-3" aria-hidden />
              Stop after this one
            </button>
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bp-tint-strong)]">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(4, pct)}%`, background: "linear-gradient(90deg, #0c5290, #1a8fd4)" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`bp-no-print flex flex-wrap items-center gap-3 ${compact ? "" : "rounded-2xl border border-[var(--bp-rule)] bg-white px-5 py-4"}`}>
      {compact ? null : (
        <p className="min-w-0 flex-1 text-sm leading-6 text-[var(--bp-muted)]">
          {allWritten
            ? "Every section BCA writes is in. Rewrite any section after you add more."
            : `BCA has written ${progress.written} of ${progress.toWrite} sections. Each one takes about half a minute.`}
        </p>
      )}
      <button
        type="button"
        onClick={() => buildAll({ onlyMissing: !allWritten })}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--bp-navy)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(5,30,54,0.8)] transition-colors hover:bg-[var(--bp-blue)]"
      >
        <AvaHalo size={18} dark />
        {allWritten ? "Rewrite everything" : progress.written ? "Write the rest" : "Write my blueprint"}
      </button>
    </div>
  );
}

export function DownloadMenu({ pageSlug }: { pageSlug?: string }) {
  const { knowledge, payload, coachName, decision } = usePractice();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const name = coachName || "Coach";

  function download(slug?: string) {
    const md = blueprintMarkdown(row, { coachName: name, pageSlug: slug, decision });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = blueprintFileName(name, slug);
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  const item =
    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[var(--bp-tint)] focus-visible:bg-[var(--bp-tint)]";

  return (
    <div ref={ref} className="bp-no-print relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:ring-[var(--bp-sky)]"
      >
        <Download className="h-4 w-4" aria-hidden />
        Download
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[var(--bp-rule)] bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(5,30,54,0.45)]">
          <button type="button" className={item} onClick={() => download()}>
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bp-blue)]" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-[var(--bp-ink)]">Whole blueprint for your AI</span>
              <span className="block text-xs text-[var(--bp-muted)]">One Markdown file. Paste it into ChatGPT, Claude or any assistant.</span>
            </span>
          </button>
          {pageSlug ? (
            <button type="button" className={item} onClick={() => download(pageSlug)}>
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bp-blue)]" aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-[var(--bp-ink)]">Just this page</span>
                <span className="block text-xs text-[var(--bp-muted)]">Markdown, this page only.</span>
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              window.setTimeout(() => window.print(), 50);
            }}
          >
            <Printer className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bp-blue)]" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-[var(--bp-ink)]">Save as PDF</span>
              <span className="block text-xs text-[var(--bp-muted)]">Print this view, then choose Save as PDF.</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function StillNeeded() {
  const { knowledge, payload, setAssistantOpen, href, stayOnPage } = usePractice();
  if (!knowledge || !payload) return null;
  const needed = stillNeeded({ ...knowledge, payload });
  if (!needed.length) return null;
  return (
    <section className="bp-no-print rounded-2xl bg-[#fffaf0] px-5 py-5 ring-1 ring-[#f1dfb8] @2xl:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#5c3a00]">
          Still needed from you: {needed.length} {needed.length === 1 ? "thing" : "things"}
        </h2>
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#5c3a00] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#7a4d00]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Talk it through
        </button>
      </div>
      <ul className="mt-3 grid gap-x-8 gap-y-1 @3xl:grid-cols-2">
        {needed.map((ref) => (
          <li key={ref.key}>
            <Link
              href={`${href(ref.page.href)}#s-${ref.key.replace(":", "-")}`}
              scroll={stayOnPage ? false : undefined}
              className="group grid grid-cols-[0.75rem_1fr_auto] items-baseline gap-2 rounded-md py-1 text-sm text-[#6b4a10] hover:text-[#3d2800]"
            >
              <span aria-hidden className="h-1.5 w-1.5 -translate-y-px rounded-full bg-[#d4534a]" />
              <span className="min-w-0 font-medium">{ref.section.title}</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[#a8894f]">
                {ref.page.title}
                <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Zander's welcome video on the landing cover: why the Blueprint works this way and the three steps. */
const COVER_VIDEO = "/tutorials/blueprint-welcome.mp4";
const COVER_POSTER = "/tutorials/blueprint-welcome-poster.jpg";
const COVER_VIDEO_SEEN_KEY = "bp-welcome-video-seen";

// First visits get the full thumbnail. Once played, the cover keeps a slim play button instead.
function CoverVideo() {
  const [seen, setSeen] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after hydration
      setSeen(localStorage.getItem(COVER_VIDEO_SEEN_KEY) === "1");
    } catch {
      // Storage blocked: always show the thumbnail.
    }
  }, []);

  function play() {
    setPlaying(true);
    try {
      localStorage.setItem(COVER_VIDEO_SEEN_KEY, "1");
    } catch {
      // Not remembered; harmless.
    }
  }

  if (seen && !playing) {
    return (
      <button
        type="button"
        onClick={play}
        className="bp-no-print group inline-flex shrink-0 items-center gap-3 self-start rounded-full bg-white/10 py-2 pl-2 pr-5 text-left ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-white/16 @3xl:self-center"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0c5290] shadow-[0_6px_16px_rgba(2,12,27,0.3)] transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-white">Why we build it for you</span>
          <span className="block text-xs text-white/65">A welcome from Zander · 1 min 30</span>
        </span>
      </button>
    );
  }

  return (
    <div className="bp-no-print w-full max-w-[28rem] shrink-0 overflow-hidden rounded-2xl bg-[#051e36] shadow-[0_18px_40px_rgba(2,12,27,0.35)] ring-1 ring-white/15 @3xl:w-[22rem] @5xl:w-[26rem]">
      {playing ? (
        <video
          className="block aspect-video w-full"
          controls
          autoPlay
          playsInline
          src={COVER_VIDEO}
          aria-label="Why we build it for you, a welcome from Zander"
        />
      ) : (
        <button type="button" onClick={play} className="group relative block w-full" aria-label="Play: why we build it for you, a welcome from Zander">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={COVER_POSTER} alt="" className="block aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        </button>
      )}
    </div>
  );
}

export function BlueprintCover({ flush = false }: { flush?: boolean }) {
  const { coachName, payload } = usePractice();
  const progress = useBlueprintProgress();
  if (!progress || !payload) return null;
  const date = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const location = payload.identity.location?.value?.trim();
  const name = coachName.trim();
  const summary = (
    <>
      {progress.written} of {progress.toWrite} sections written
      <span className="mx-2 text-white/35">·</span>
      {progress.yoursTodo ? `${progress.yoursTodo} to do` : "Nothing to do"}
    </>
  );

  // The landing page: a compact band, so the contents start above the fold.
  // Their name sits above the title as a spaced eyebrow.
  if (flush) {
    return (
      <header className="bp-cover px-6 pb-10 pt-9 text-white @2xl:px-12 @2xl:pb-11 @2xl:pt-11">
        <div className="flex flex-col gap-7 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:gap-10">
          <div className="min-w-0">
            {name ? (
              <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.32em] text-white/80">{name}</p>
            ) : null}
            <h1 className="bp-display mt-4 text-[2.75rem] font-medium leading-[0.98] tracking-[-0.035em] @2xl:text-[3.75rem]">
              Your Portfolio
              <br />
              <span className="italic font-normal text-[#bfe2fb]">Blueprint</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-[1.55] text-white/80">
              You bring the story, the proof and the voice. We turn it into your market, your messages and your offer, ready to launch.
            </p>
          </div>
          <CoverVideo />
        </div>
      </header>
    );
  }

  return (
    <header className="bp-cover rounded-[28px] px-7 pb-9 pt-10 text-white @2xl:px-12 @2xl:pb-12 @2xl:pt-14">
      <div className="flex items-center justify-between gap-4 text-[0.8125rem] text-white/75">
        <span className="font-semibold tracking-[0.02em] text-white/90">Business Coach Academy</span>
        <span className="bp-num">{date}</span>
      </div>
      <div className="mt-20 @2xl:mt-28">
        <h1 className="bp-display text-[2.75rem] font-medium leading-[0.98] tracking-[-0.035em] @2xl:text-[4.5rem]">
          The Practice
          <br />
          <span className="italic font-normal text-[#bfe2fb]">Blueprint</span>
        </h1>
      </div>
      <div className="mt-14 flex flex-wrap items-end justify-between gap-6 border-t border-white/20 pt-5">
        <div>
          <p className="text-[1.625rem] font-semibold tracking-[-0.015em]">{name || "Your practice"}</p>
          {location ? <p className="mt-0.5 text-sm text-white/65">{location}</p> : null}
        </div>
        <p className="bp-num text-sm text-white/80">{summary}</p>
      </div>
    </header>
  );
}

export function Contents() {
  const { href, stayOnPage } = usePractice();
  return (
    <nav aria-label="Contents" className="bp-keep">
      <h2 className="text-[0.8125rem] font-semibold text-[var(--bp-muted)]">Contents</h2>
      <ol className="mt-4 grid gap-x-10 gap-y-6 @xl:grid-cols-2">
        {DOCUMENT_GROUPS.map((group, i) => (
          <li key={group.label}>
            <a href={`#c-${i + 1}`} className="bp-display text-[1.375rem] font-medium text-[var(--bp-navy)] hover:text-[var(--bp-blue)]">
              <span className="italic text-[var(--bp-sky)]">{i + 1}.</span> {group.label}
            </a>
            <ul className="mt-2 space-y-1">
              {documentPages(group).map((page) => (
                <li key={page.slug}>
                  <Link href={href(page.href)} scroll={stayOnPage ? false : undefined} className="text-sm text-[var(--bp-muted)] hover:text-[var(--bp-blue)] hover:underline">
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </nav>
  );
}
