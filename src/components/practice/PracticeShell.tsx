"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { MessageCircle, MessageSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { BLUEPRINT_GROUPS, BLUEPRINT_PAGES, stillNeeded } from "@/lib/practiceKnowledge/blueprint";
import { guidePage } from "@/lib/practiceKnowledge/clientSessions";

import { BlueprintAssistant } from "./BlueprintAssistant";
import { DownloadMenu } from "./document/DocumentParts";
import { blueprintDisplay } from "./document/fonts";
import { PracticeComments } from "./PracticeComments";
import { usePractice } from "./PracticeProvider";
import "./document/blueprint.css";

const NAV_KEY = "practice-nav-open";
const NAV_WIDTH_KEY = "practice-nav-width";
/** 15rem, plus 10 percent, plus another 5 percent. */
const NAV_WIDTH_DEFAULT = 277;
const NAV_WIDTH_MIN = 200;
const NAV_WIDTH_MAX = 480;

const WIDE_QUERY = "(min-width: 1600px)";

/** True on screens wide enough for the nav, the document and the assistant side by side. */
function useWideScreen() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true
  );
}

function clampNavWidth(value: number) {
  return Math.round(Math.min(NAV_WIDTH_MAX, Math.max(NAV_WIDTH_MIN, value)));
}

function NavResizer({
  width,
  onChange,
}: {
  width: number;
  onChange: (width: number) => void;
}) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const latest = useRef(width);
  const [dragging, setDragging] = useState(false);

  function apply(next: number) {
    const value = clampNavWidth(next);
    latest.current = value;
    onChange(value);
    return value;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    apply(drag.current.startWidth + event.clientX - drag.current.startX);
  }

  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    window.localStorage.setItem(NAV_WIDTH_KEY, String(latest.current));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === "ArrowLeft"
        ? width - 16
        : event.key === "ArrowRight"
          ? width + 16
          : event.key === "Home"
            ? NAV_WIDTH_MIN
            : event.key === "End"
              ? NAV_WIDTH_MAX
              : null;
    if (next === null) return;
    event.preventDefault();
    const value = apply(next);
    window.localStorage.setItem(NAV_WIDTH_KEY, String(value));
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize blueprint"
      aria-valuemin={NAV_WIDTH_MIN}
      aria-valuemax={NAV_WIDTH_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      className="group absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-col-resize touch-none lg:block"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        const value = apply(NAV_WIDTH_DEFAULT);
        window.localStorage.setItem(NAV_WIDTH_KEY, String(value));
      }}
      onKeyDown={onKeyDown}
    >
      <span
        className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 ${
          dragging ? "bg-sky-400" : "bg-transparent group-hover:bg-sky-400"
        }`}
      />
    </div>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="mt-px h-4 w-4 shrink-0">
      <path d="M6.5 3.5h7l4 4v12a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M13.5 3.5v4h4M9 12h6M9 15.5h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PracticeShell({
  children,
  embedded = false,
}: {
  children: ReactNode;
  /** Mounted inside an admin page: no full-bleed, no sticky nav. */
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const { loading, error, knowledge, payload, approvePage, href, assistantOpen, setAssistantOpen } = usePractice();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const wide = useWideScreen();
  const [navWidth, setNavWidth] = useState(NAV_WIDTH_DEFAULT);
  const page = BLUEPRINT_PAGES.find((item) => href(item.href) === pathname) ?? null;
  const group = BLUEPRINT_GROUPS.find((item) => item.pages.some((entry) => href(entry.href) === pathname)) ?? null;
  const canApprove = Boolean(page && !guidePage(page.slug));
  const pageApproved = Boolean(page && payload?.review.approved_pages?.value?.[page.slug]);
  const noteCount = page
    ? (payload?.review.notes?.value ?? []).filter((note) => note.page === page.slug).length
    : 0;
  const ready = !loading && payload && knowledge;
  const isDocument = page?.slug === "blueprint";
  // With the assistant open on a normal laptop, fold the contents to a rail so the document keeps its width.
  const showNav = navOpen && (wide || !assistantOpen || !ready);
  const openPages = new Set(
    ready ? stillNeeded({ ...knowledge, payload }).map((ref) => ref.page.slug) : []
  );

  useEffect(() => {
    setNavOpen(window.localStorage.getItem(NAV_KEY) !== "0");
    const stored = Number(window.localStorage.getItem(NAV_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) setNavWidth(clampNavWidth(stored));
  }, []);

  function toggleNav() {
    if (navOpen && !showNav) {
      setAssistantOpen(false);
      return;
    }
    setNavOpen((open) => {
      const next = !open;
      window.localStorage.setItem(NAV_KEY, next ? "1" : "0");
      return next;
    });
  }

  const nav = (
    <nav aria-label="Practice blueprint" className="space-y-1">
      {BLUEPRINT_GROUPS.map((section) => (
        <div key={section.label} className="pt-3.5 first:pt-0">
          <p className="px-2.5 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
            {section.label}
          </p>
          <ul>
            {section.pages.map((item) => {
              const current = pathname === href(item.href);
              return (
                <li key={item.slug}>
                  <Link
                    href={href(item.href)}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-start gap-2 rounded-[7px] px-2.5 py-1.5 text-sm leading-snug ${
                      current
                        ? "bg-[#e0f2fe] font-semibold text-[#075985] [&_svg]:text-[#0369a1]"
                        : "text-[#334155] hover:bg-[#eef2f7] hover:text-[#0f172a] [&_svg]:text-[#94a3b8]"
                    }`}
                  >
                    <DocIcon />
                    <span className="min-w-0 flex-1">{item.title}</span>
                    {openPages.has(item.slug) ? (
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d99a2b]"
                        title="Needs something from you"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div
      className={`bp-doc ${blueprintDisplay.variable} ${
        embedded
          ? "flex min-h-[70vh] flex-col overflow-clip rounded-2xl border border-slate-200 bg-white lg:flex-row lg:items-stretch"
          : "-mx-4 -mt-4 -mb-6 flex min-h-[calc(100dvh-3.5rem)] flex-col bg-white md:-mx-[60px] md:group-data-[ai-docked]/appshell:-mr-[calc(60px+28rem)] lg:flex-row lg:items-stretch"
      }`}
      style={{ "--practice-nav-w": `${navWidth}px` } as CSSProperties}
    >
      <aside
        className={`relative shrink-0 border-slate-200/70 bg-[#f8fafc] lg:border-r ${
          embedded
            ? "lg:sticky lg:top-[var(--blueprint-header-h,0px)] lg:h-[calc(100dvh-var(--blueprint-header-h,0px))]"
            : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]"
        } ${
          showNav ? "w-full border-b lg:w-[var(--practice-nav-w)] lg:border-b-0" : "w-14 border-b lg:border-b-0"
        }`}
      >
        <div className="lg:h-full lg:overflow-y-auto">
        <div className={`flex items-center gap-2 border-b border-slate-200/70 px-3 py-3 ${showNav ? "justify-between" : "justify-center"}`}>
          {showNav ? <p className="text-[0.8125rem] font-semibold text-[#0f172a]">Blueprint</p> : null}
          <button
            type="button"
            onClick={toggleNav}
            aria-expanded={showNav}
            aria-label={showNav ? "Collapse blueprint" : "Expand blueprint"}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {showNav ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>
        {showNav ? <div className="px-3 py-4">{nav}</div> : null}
        </div>
        {showNav ? <NavResizer width={navWidth} onChange={setNavWidth} /> : null}
      </aside>

      <section className="min-w-0 flex-1 bg-white">
        <div className="@container mx-auto w-full max-w-[54rem] px-5 py-8 md:px-10 md:py-10">
        {isDocument ? (
          <div className="bp-no-print mb-5 flex flex-wrap items-center justify-end gap-2">
            {ready ? <DownloadMenu /> : null}
            {ready && !assistantOpen ? (
              <button
                type="button"
                onClick={() => {
                  setCommentsOpen(false);
                  setAssistantOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--bp-blue)]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Talk it through
              </button>
            ) : null}
          </div>
        ) : (
        <header className="border-b border-slate-200/70 pb-6">
          {group ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#0369a1]">
              {group.label}
            </p>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
            {page?.heading ?? "Blueprint"}
          </h1>
          {ready && page ? (
            <div className="flex shrink-0 items-center gap-2">
              {canApprove ? (
              <button
                type="button"
                aria-pressed={pageApproved}
                onClick={() => approvePage(page.slug)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  pageApproved
                    ? "bg-[#0c5290] text-white"
                    : "bg-white text-slate-800 ring-1 ring-slate-300"
                }`}
              >
                {pageApproved ? "Page approved" : "Approve page"}
              </button>
              ) : null}
              <DownloadMenu pageSlug={page.slug === "command" ? undefined : page.slug} />
              {assistantOpen ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setCommentsOpen(false);
                    setAssistantOpen(true);
                  }}
                  className="bp-no-print inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--bp-blue)]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Talk it through
                </button>
              )}
              {commentsOpen ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setAssistantOpen(false);
                    setCommentsOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-300"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  Comments{noteCount ? ` ${noteCount}` : ""}
                </button>
              )}
            </div>
          ) : null}
          </div>
          {page?.summary ? (
            <p className="mt-2.5 text-lg leading-[1.55] text-[#475569]">{page.summary}</p>
          ) : null}
        </header>
        )}
        <div className={isDocument ? "" : "pt-8"}>
          {ready ? (
            children
          ) : (
            <p className="text-sm text-slate-600">{error || "Opening your blueprint…"}</p>
          )}
        </div>
        </div>
      </section>

      {ready && commentsOpen && page && payload ? (
        <PracticeComments
          page={page.slug}
          notes={payload.review.notes?.value ?? []}
          onClose={() => setCommentsOpen(false)}
        />
      ) : null}

      {ready && assistantOpen && !commentsOpen ? (
        <>
          <aside
            aria-label="Talk it through"
            className={`bp-no-print hidden w-[23rem] shrink-0 border-l border-slate-200 lg:block ${
              embedded
                ? "lg:sticky lg:top-[var(--blueprint-header-h,0px)] lg:h-[calc(100dvh-var(--blueprint-header-h,0px))]"
                : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]"
            }`}
          >
            <BlueprintAssistant onClose={() => setAssistantOpen(false)} />
          </aside>
          <div className="bp-no-print fixed inset-0 z-50 flex flex-col justify-end bg-[#051e36]/35 lg:hidden">
            <div className="h-[85dvh] overflow-hidden rounded-t-3xl shadow-[0_-20px_50px_-20px_rgba(5,30,54,0.6)]">
              <BlueprintAssistant onClose={() => setAssistantOpen(false)} />
            </div>
          </div>
        </>
      ) : null}

      {ready && !assistantOpen ? (
        <button
          type="button"
          onClick={() => {
            setCommentsOpen(false);
            setAssistantOpen(true);
          }}
          className="bp-no-print fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--bp-navy)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_rgba(5,30,54,0.7)] lg:hidden"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Talk it through
        </button>
      ) : null}
    </div>
  );
}
