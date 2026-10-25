"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import type { AgentShow } from "@/lib/agent/types";
import { BLUEPRINT_GROUPS, BLUEPRINT_PAGES, sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import { workflowQueue } from "@/lib/practiceKnowledge/sectionWorkflow";

import { AvaHalo } from "@/components/ava/AvaHalo";
import { setAvaPageHost } from "@/components/ava/avaPageHost";
import { NavHoverHints } from "@/components/layout/NavHoverHints";

import { useSectionComments } from "./comments/SectionCommentsContext";
import { CommentsButton, PageCommentBadge } from "./comments/SectionCommentsUI";
import { DownloadMenu, PageBlurb } from "./document/DocumentParts";
import { OPEN_SECTION_EVENT } from "./document/SectionView";
import { PageIcon } from "./pageIcons";
import { usePractice } from "./PracticeProvider";
import { useMatchesBreakpoint } from "@/hooks/useBreakpoint";
import "./document/blueprint.css";

// Loaded when the assistant or comments open: it carries the chat, markdown and voice SDK.
const SidePanel = dynamic(() => import("./SidePanel").then((m) => m.SidePanel), { ssr: false });

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


export function PracticeShell({
  children,
  embedded = false,
  path,
  switcher,
}: {
  children: ReactNode;
  /** Admin only: whose blueprint this is, and a way to switch coach. Top of the sidebar. */
  switcher?: ReactNode;
  /** Admin blueprint: fill the page under the header, flush to the app sidebar. */
  embedded?: boolean;
  /** Practice path to treat as the open page, when this shell is not on its own route. */
  path?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, error, knowledge, payload, href, assistantOpen, setAssistantOpen, stayOnPage, viewer, sample } = usePractice();
  const rootRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const here = path ?? pathname;
  const [navOpen, setNavOpen] = useState(true);
  // Phones: the contents slide in from the left instead of sitting above every page.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = useWideScreen();
  // Mount the assistant once: docked at lg+, as a sheet below (not both, hidden by CSS).
  const sidePanelDesktop = useMatchesBreakpoint("lg");
  const [navWidth, setNavWidth] = useState(NAV_WIDTH_DEFAULT);
  const page =
    BLUEPRINT_PAGES.find((item) => (path ? item.href === here : href(item.href) === here)) ?? null;
  const ready = !loading && payload && knowledge;
  const comments = useSectionComments();
  // The right-hand column holds one thing: a section's comments, or the conversation.
  const discussing = comments?.openKey && sectionByKey(comments.openKey) ? comments.openKey : null;
  const side = ready && comments?.panelOpen ? "comments" : ready && assistantOpen ? "assistant" : null;
  function openAssistant() {
    comments?.close();
    setAssistantOpen(true);
  }
  // Ava moving the document: the page she names, then her section scrolled to and lit up.
  // On phones the sheet drops to half height so the page shows above it.
  const focusRef = useRef<{ page: string; section: string | null } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [peek, setPeek] = useState(false);
  if (peek && side !== "assistant") setPeek(false);
  function showOnPage(show: AgentShow) {
    const target = BLUEPRINT_PAGES.find((item) => item.slug === show.page);
    if (!target) return;
    focusRef.current = { page: target.slug, section: show.section };
    setFocusNonce((n) => n + 1);
    setPeek(true);
    if (target.slug !== page?.slug) router.push(href(target.href), { scroll: false });
  }
  // The top-bar Ava button opens this Ava, beside the document, never a second one on top.
  const assistantShown = side === "assistant";
  const toggleAva = useRef<() => void>(() => {});
  useEffect(() => {
    toggleAva.current = () => {
      if (assistantShown) setAssistantOpen(false);
      else openAssistant();
    };
  });
  useEffect(() => {
    if (sample) return;
    setAvaPageHost({ open: assistantShown, toggle: () => toggleAva.current() });
    return () => setAvaPageHost(null);
  }, [sample, assistantShown]);
  const isDocument = page?.slug === "blueprint";
  // The landing page draws its own full-width cover, with no page header.
  const isHome = page?.slug === "command";
  // With the assistant open on a normal laptop, fold the contents to a rail so the document keeps its width.
  const showNav = navOpen && (wide || !side);
  const mine = viewer === "bca" ? "bca" : "coach";
  const openPages = new Set(
    ready
      ? workflowQueue({ ...knowledge, payload })
          .filter((item) => item.work.owner === mine)
          .map((item) => item.ref.page.slug)
      : []
  );

  useEffect(() => {
    setNavOpen(window.localStorage.getItem(NAV_KEY) !== "0");
    const stored = Number(window.localStorage.getItem(NAV_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) setNavWidth(clampNavWidth(stored));
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.scrollTo(0, 0);
    root.querySelector("section")?.scrollTo(0, 0);
  }, [here]);

  // The open panel follows the page. A thread from the page you just left returns to that page's list.
  const openKey = comments?.openKey ?? null;
  const panelOpen = comments?.panelOpen ?? false;
  const openList = comments?.openList;
  useEffect(() => {
    if (!panelOpen || !page?.slug || !openKey || !openList) return;
    const open = sectionByKey(openKey);
    if (open && open.page.slug !== page.slug) openList();
  }, [panelOpen, page?.slug, openKey, openList]);

  // A link to a section (#s-page-id) or one box (#f-group.key) lands before the blueprint has
  // loaded, so once it is on screen: open a shut section, scroll to the spot and light it up.
  const shown = Boolean(ready);
  useEffect(() => {
    if (!shown) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id.startsWith("s-") && !id.startsWith("f-")) return;
    if (id.startsWith("s-")) window.dispatchEvent(new CustomEvent(OPEN_SECTION_EVENT, { detail: id }));
    let tries = 0;
    let timer = 0;
    const find = () => {
      const el = document.getElementById(id);
      if (!el) {
        // Boxes can take a few seconds on a slow load.
        if (++tries < 120) timer = window.setTimeout(find, 50);
        return;
      }
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: id.startsWith("f-") ? "center" : "start", behavior: still ? "auto" : "smooth" });
      // Ava's glow (bp-ava-focus), run as an animation: a box redraws its own classes while it loads.
      const lit = "0 0 0 3px rgba(26, 143, 212, 0.5), 0 0 0 10px rgba(26, 143, 212, 0.12)";
      const off = "0 0 0 3px rgba(26, 143, 212, 0), 0 0 0 10px rgba(26, 143, 212, 0)";
      el.animate(
        [{ boxShadow: lit }, { boxShadow: lit, offset: 0.4 }, { boxShadow: still ? lit : off }],
        { duration: 2600, easing: "ease-out" },
      );
    };
    find();
    return () => window.clearTimeout(timer);
  }, [shown]);

  // After the scroll to the top on a new page, so Ava's section wins. The page may still be rendering, so look for a moment.
  const pageSlug = page?.slug;
  useEffect(() => {
    const focus = focusRef.current;
    if (!focus || !shown || focus.page !== pageSlug) return;
    const root = rootRef.current;
    if (!focus.section) {
      focusRef.current = null;
      root?.scrollTo(0, 0);
      root?.querySelector("section")?.scrollTo(0, 0);
      return;
    }
    const id = `s-${focus.section.replace(":", "-")}`;
    let tries = 0;
    let timer = 0;
    const find = () => {
      const el = document.getElementById(id);
      if (!el) {
        if (++tries < 40) timer = window.setTimeout(find, 50);
        else focusRef.current = null;
        return;
      }
      focusRef.current = null;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      el.classList.remove("bp-ava-focus");
      void el.offsetWidth;
      el.classList.add("bp-ava-focus");
      window.setTimeout(() => el.classList.remove("bp-ava-focus"), 2600);
    };
    find();
    return () => window.clearTimeout(timer);
  }, [focusNonce, shown, pageSlug]);

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

  // Collapsed (compact): icons only, like the app sidebar, with the name on hover.
  const renderNav = (compact: boolean) => (
    <nav aria-label="Practice blueprint" className="space-y-1">
      {BLUEPRINT_GROUPS.map((section) => (
        <div
          key={section.label}
          className={compact ? "border-t border-slate-200/70 pt-2 first:border-t-0 first:pt-0" : "pt-3.5 first:pt-0"}
        >
          {compact ? null : (
            <p className="px-2.5 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
              {section.label}
            </p>
          )}
          <ul className={compact ? "flex flex-col items-center gap-0.5 pb-2" : undefined}>
            {section.pages.map((item) => {
              const current = path ? item.href === here : pathname === href(item.href);
              const waiting = openPages.has(item.slug);
              return (
                <li key={item.slug}>
                  <Link
                    href={href(item.href)}
                    scroll={stayOnPage ? false : undefined}
                    aria-current={current ? "page" : undefined}
                    data-hint-label={item.title}
                    data-hint-description={item.heading || undefined}
                    onClick={() => setDrawerOpen(false)}
                    className={`${
                      compact
                        ? "relative flex h-9 w-9 items-center justify-center rounded-[7px]"
                        : "flex items-start gap-2 rounded-[7px] px-2.5 py-1.5 text-sm leading-snug"
                    } ${
                      current
                        ? "bg-[#e0f2fe] font-semibold text-[#075985] [&_svg]:text-[#0369a1]"
                        : "text-[#334155] hover:bg-[#eef2f7] hover:text-[#0f172a] [&_svg]:text-[#94a3b8]"
                    }`}
                  >
                    {compact ? (
                      <>
                        <PageIcon slug={item.slug} className="h-[18px] w-[18px] shrink-0" />
                        <span className="sr-only">{item.title}</span>
                        {waiting ? (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#d4534a]" />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <PageIcon slug={item.slug} className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">{item.title}</span>
                        {waiting ? (
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4534a]"
                            title={viewer === "bca" ? "Waiting on BCA" : "Waiting on you"}
                          />
                        ) : null}
                        <PageCommentBadge pageSlug={item.slug} />
                      </>
                    )}
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
    // contain:paint keeps the document column's overflow from lengthening the
    // window. Without it, scrolling to the last card slides the page up and
    // leaves an empty white block where the contents column used to be.
    <div
      ref={rootRef}
      className={`bp-doc app-canvas-bg print:bg-white ${
        embedded
          ? "flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-none [contain:paint] lg:flex-row lg:items-stretch lg:overflow-hidden"
          : "-mx-4 -mt-4 -mb-6 flex min-h-[calc(100dvh-3.5rem)] flex-col md:-mx-[60px] lg:flex-row lg:items-stretch"
      }`}
      style={{ "--practice-nav-w": `${navWidth}px` } as CSSProperties}
    >
      <div className="bp-no-print sticky top-0 z-30 border-b border-slate-200/70 bg-[#f8fafc]/95 px-3 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-controls="practice-nav-drawer"
          className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100"
        >
          <PanelLeftOpen className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
          <span className="shrink-0 text-slate-500">{switcher ? "Blueprint" : "My Blueprint"}</span>
          {page ? (
            <>
              <span className="shrink-0 text-slate-300" aria-hidden>/</span>
              <span className="min-w-0 truncate font-semibold text-[#0f172a]">{page.title}</span>
            </>
          ) : null}
        </button>
      </div>

      {/* In a portal: the shell's contain:paint would clip a fixed layer to the document column. */}
      {drawerOpen ? createPortal(
        <div className="bp-no-print fixed inset-0 z-[110] lg:hidden" role="dialog" aria-modal="true" aria-label="Blueprint contents">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close contents"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id="practice-nav-drawer"
            className="bp-nav-drawer absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-[#f8fafc] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-3 py-3">
              {switcher ? (
                <div className="min-w-0 flex-1">{switcher}</div>
              ) : (
                <p className="text-[0.8125rem] font-semibold text-[#0f172a]">My Blueprint</p>
              )}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close contents"
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">{renderNav(false)}</div>
          </div>
        </div>,
        document.body
      ) : null}

      <aside
        ref={asideRef}
        className={`relative hidden shrink-0 border-slate-200/70 bg-[#f8fafc] lg:block lg:border-r ${
          embedded
            ? "lg:h-full lg:min-h-0 lg:overflow-hidden"
            : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:max-h-[calc(100dvh-3.5rem)] lg:self-start"
        } ${
          showNav ? "lg:w-[var(--practice-nav-w)]" : "w-14"
        }`}
      >
        <div className="lg:h-full lg:overflow-y-auto lg:overscroll-y-none">
        <div className={`flex items-center gap-2 border-b border-slate-200/70 px-3 py-3 ${showNav ? "justify-between" : "justify-center"}`}>
          {showNav ? (
            switcher ? (
              <div className="min-w-0 flex-1">{switcher}</div>
            ) : (
              <p className="text-[0.8125rem] font-semibold text-[#0f172a]">My Blueprint</p>
            )
          ) : null}
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
        {showNav ? <div className="px-3 py-4">{renderNav(false)}</div> : <div className="py-3">{renderNav(true)}</div>}
        </div>
        {showNav ? <NavResizer width={navWidth} onChange={setNavWidth} /> : null}
      </aside>
      <NavHoverHints container={asideRef} mode={showNav ? "rest" : "instant"} placement="right" enabled={sidePanelDesktop === true} />

      <section className={`bp-print-root app-canvas-bg @container flex min-w-0 flex-1 flex-col print:block print:bg-white ${embedded ? "lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-none lg:[contain:paint]" : ""}`}>
        {isHome ? (
          ready ? children : <p className="px-5 py-8 text-sm text-slate-600 md:px-10">{error || "Opening your blueprint…"}</p>
        ) : (
        <div className="@container mx-auto w-full max-w-[54rem] px-5 pt-8 pb-10 md:px-10 md:pt-10 print:p-0">
        {isDocument ? (
          <div className="bp-no-print mb-5 flex flex-wrap items-center justify-end gap-2">
            {ready ? <DownloadMenu /> : null}
            {ready && side !== "comments" ? <CommentsButton /> : null}
            {ready && side !== "assistant" ? (
              <button
                type="button"
                onClick={openAssistant}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--bp-blue)]"
              >
                <AvaHalo size={18} dark />
                Ask Ava
              </button>
            ) : null}
          </div>
        ) : (
        <header className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
            {page?.title ?? "Blueprint"}
          </h1>
          {ready && page ? (
            <div className="bp-no-print flex shrink-0 items-center gap-2">
              {side !== "comments" ? <CommentsButton /> : null}
              {side !== "assistant" ? (
                <button
                  type="button"
                  onClick={openAssistant}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--bp-blue)]"
                >
                  <AvaHalo size={18} dark />
                  Ask Ava
                </button>
              ) : null}
            </div>
          ) : null}
          </div>
          {page ? (
            <PageBlurb page={page} className="mt-2.5 text-lg leading-[1.55] text-[#475569]" />
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
        )}
      </section>

      {side && sidePanelDesktop === true ? (
          <aside
            aria-label={side === "comments" ? "Comments" : "Ava"}
            className={`bp-no-print hidden w-[23rem] shrink-0 flex-col border-l border-slate-200 lg:flex ${
              embedded
                ? "lg:h-full lg:min-h-0"
                : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:max-h-[calc(100dvh-3.5rem)] lg:self-start"
            }`}
          >
            <SidePanel mode={side} sectionKey={discussing} page={page} canExpand onShow={showOnPage} />
          </aside>
      ) : null}
      {side && sidePanelDesktop === false ? (
          <div
            className={`bp-no-print fixed inset-0 z-50 flex flex-col justify-end lg:hidden ${
              peek ? "pointer-events-none" : "bg-[#051e36]/35"
            }`}
          >
            <div
              className={`h-[85dvh] overflow-hidden rounded-t-3xl shadow-[0_-20px_50px_-20px_rgba(5,30,54,0.6)] ${
                peek ? "pointer-events-auto" : ""
              }`}
              style={peek ? { height: "50dvh" } : undefined}
            >
              <SidePanel mode={side} sectionKey={discussing} page={page} onShow={showOnPage} />
            </div>
          </div>
      ) : null}

      {ready && !side ? (
        <button
          type="button"
          onClick={openAssistant}
          className="bp-no-print fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--bp-navy)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_rgba(5,30,54,0.7)] lg:hidden"
        >
          <AvaHalo size={18} dark />
          Ask Ava
        </button>
      ) : null}
    </div>
  );
}
