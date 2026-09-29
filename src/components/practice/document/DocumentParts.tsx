"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, FileText, Loader2, MessageCircle, Printer, Sparkles, Square } from "lucide-react";

import {
  BLUEPRINT_GROUPS,
  BLUEPRINT_SECTIONS,
  buildOrder,
  sectionState,
  stillNeeded,
  type BlueprintGroup,
  type BlueprintLink,
} from "@/lib/practiceKnowledge/blueprint";
import { guidePage } from "@/lib/practiceKnowledge/clientSessions";
import { blueprintFileName, blueprintMarkdown } from "@/lib/practiceKnowledge/exportMarkdown";

import { usePractice } from "../PracticeProvider";
import { SessionGuide } from "../SessionGuide";
import { SectionView } from "./SectionView";

/** Pages that belong in the document (not the Command Center or the whole-document page). */
export function documentPages(group: BlueprintGroup): BlueprintLink[] {
  return group.pages.filter((p) => p.slug !== "command" && p.slug !== "blueprint");
}

export const DOCUMENT_GROUPS = BLUEPRINT_GROUPS.filter((g) => documentPages(g).length > 0);

export function useBlueprintProgress() {
  const { knowledge, payload } = usePractice();
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const build = buildOrder();
  const written = build.filter((k) => knowledge.built_sections[k]).length;
  const needed = stillNeeded(row);
  const approvals = payload.review.approved_sections?.value ?? {};
  const reviewable = BLUEPRINT_SECTIONS.filter((r) => r.section.source !== "live" && sectionState(r, row) === "ready");
  const approved = reviewable.filter((r) => approvals[r.key]).length;
  return { written, toWrite: build.length, needed, approved, reviewable: reviewable.length };
}

export function PageView({ page, showTitle = true }: { page: BlueprintLink; showTitle?: boolean }) {
  const guide = guidePage(page.slug);
  return (
    <div id={`p-${page.slug}`} className="scroll-mt-20">
      {showTitle ? (
        <header className="bp-keep mb-8">
          <h2 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] text-[var(--bp-ink)] @2xl:text-[1.875rem]">
            {page.title}
          </h2>
          <p className="mt-2 max-w-[60ch] text-[1.0625rem] leading-[1.6] text-[var(--bp-muted)]">{page.summary}</p>
        </header>
      ) : null}
      {guide ? (
        <SessionGuide guide={guide} />
      ) : (
        <div className="space-y-14">
          {page.sections.map((section) => (
            <SectionView
              key={section.id}
              sectionRef={{
                group: BLUEPRINT_GROUPS.find((g) => g.pages.includes(page))!,
                page,
                section,
                key: `${page.slug}:${section.id}`,
              }}
            />
          ))}
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
        <Sparkles className="h-4 w-4" aria-hidden />
        {allWritten ? "Rewrite everything" : progress.written ? "Write the rest" : "Write my blueprint"}
      </button>
    </div>
  );
}

export function DownloadMenu({ pageSlug }: { pageSlug?: string }) {
  const { knowledge, payload, coachName } = usePractice();
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
    const md = blueprintMarkdown(row, { coachName: name, pageSlug: slug });
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
  const { knowledge, payload, setAssistantOpen, href } = usePractice();
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
              className="group grid grid-cols-[0.75rem_1fr_auto] items-baseline gap-2 rounded-md py-1 text-sm text-[#6b4a10] hover:text-[#3d2800]"
            >
              <span aria-hidden className="h-1.5 w-1.5 -translate-y-px rounded-full bg-[#d99a2b]" />
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

export function BlueprintCover() {
  const { coachName, payload } = usePractice();
  const progress = useBlueprintProgress();
  if (!progress || !payload) return null;
  const date = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const location = payload.identity.location?.value?.trim();

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
        <p className="mt-6 max-w-[34ch] text-[1.0625rem] leading-[1.55] text-white/80">
          Your proof, your market, your messages and your plan. Everything we need to launch your practice, in one document.
        </p>
      </div>
      <div className="mt-14 flex flex-wrap items-end justify-between gap-6 border-t border-white/20 pt-5">
        <div>
          <p className="text-[1.375rem] font-semibold tracking-[-0.01em]">{coachName || "Your practice"}</p>
          {location ? <p className="mt-0.5 text-sm text-white/65">{location}</p> : null}
        </div>
        <p className="bp-num text-sm text-white/80">
          {progress.written} of {progress.toWrite} sections written
          <span className="mx-2 text-white/35">·</span>
          {progress.needed.length ? `${progress.needed.length} still needed from you` : "Nothing needed from you"}
          <span className="mx-2 text-white/35">·</span>
          {progress.approved} approved
        </p>
      </div>
    </header>
  );
}

export function Contents() {
  const { href } = usePractice();
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
                  <Link href={href(page.href)} className="text-sm text-[var(--bp-muted)] hover:text-[var(--bp-blue)] hover:underline">
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
