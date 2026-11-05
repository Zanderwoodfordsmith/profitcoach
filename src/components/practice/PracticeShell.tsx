"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MessageSquare, PanelLeftOpen, X, Zap } from "lucide-react";

import type { AgentShow } from "@/lib/agent/types";
import { BLUEPRINT_GROUPS, BLUEPRINT_PAGES, sectionByKey, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { chatKeyPage, commentPage } from "@/lib/practiceKnowledge/pageChat";
import { avaWorkFor, pageScope } from "@/lib/launch/avaWork";
import { useAvaOpen } from "@/components/jobs/JobActivity";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useHostSupportDock, useSupportDock } from "@/components/support/SupportDock";

import { requestAvaOpen } from "@/components/ava/avaPageLink";
import { NavHoverHints } from "@/components/layout/NavHoverHints";
import { EDGE_TOGGLE_CLASS } from "@/components/layout/BossProNavToggle";
import type { SideMode } from "./SidePanel";

import { useSectionComments } from "./comments/SectionCommentsContext";
import { CommentsButton, PageCommentBadge } from "./comments/SectionCommentsUI";
import { DownloadMenu, PageBlurb } from "./document/DocumentParts";
import { PageActivity } from "./PageActivity";
import { PageStatusControl } from "./PageStatusControl";
import { useBlueprintAva } from "./ava/useBlueprintAva";
import { OPEN_SECTION_EVENT } from "./document/SectionView";
import { PageIcon } from "./pageIcons";
import { usePractice } from "./PracticeProvider";
import { useMatchesBreakpoint } from "@/hooks/useBreakpoint";
import { BLUEPRINT_LOOK } from "./blueprintLook";
import "./document/blueprint.css";
import "./document/blueprint-clean.css";

// Loaded when the chat or a call opens: it carries the chat, markdown and voice SDK.
const SidePanel = dynamic(() => import("./SidePanel").then((m) => m.SidePanel), { ssr: false });

const NAV_KEY = "practice-nav-open";
// A new key (4 Nov): everyone starts at the new, narrower default.
const NAV_WIDTH_KEY = "practice-nav-width-v2";
/** The same width as the app's main menu (w-56). */
const NAV_WIDTH_DEFAULT = 224;
const NAV_WIDTH_MIN = 200;
const NAV_WIDTH_MAX = 480;

const WIDE_QUERY = "(min-width: 1600px)";

/** The full document and the overview are not one page: no page chat or Activity there. */
const isDocument = (slug: string) => slug === "blueprint" || slug === "command";
/** Pages with a chat: every page, the Overview too (its chat is for anything not about one page, 5 Nov). */
const hasChat = (slug: string) => slug !== "blueprint";

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
  const { loading, error, knowledge, payload, href, callNonce, takeCall, stayOnPage, sample } = usePractice();
  const rootRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const here = path ?? pathname;
  const [navOpen, setNavOpen] = useState(true);
  // Where the menu's fold button sits: level with the app sidebar's own fold button.
  const [edgeTop, setEdgeTop] = useState<number | null>(null);
  // Phones: the contents slide in from the left instead of sitting above every page.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = useWideScreen();
  // Mount the side panel once: docked at lg+, as a sheet below (not both, hidden by CSS).
  const sidePanelDesktop = useMatchesBreakpoint("lg");
  const [navWidth, setNavWidth] = useState(NAV_WIDTH_DEFAULT);
  const page =
    BLUEPRINT_PAGES.find((item) => (path ? item.href === here : href(item.href) === here)) ?? null;
  const ready = !loading && payload && knowledge;
  const comments = useSectionComments();
  // Support's docked chat sits on the right: the page doesn't open a second chat beside it.
  const supportDock = useSupportDock();
  const supportDocked = Boolean(supportDock?.docked);
  useHostSupportDock(supportDocked);
  // BCA staff get Ava's waiting work on each page, pinned in her panel (4 Nov: one Ava, from the top bar).
  const viewerProfile = useDashboardProfile().profile;
  const isAdmin = viewerProfile?.role === "admin";
  // The right-hand column holds one thing: the page's chat (or a section's comments), or a call with Ava.
  const discussing =
    comments?.openKey && (sectionByKey(comments.openKey) || chatKeyPage(comments.openKey)) ? comments.openKey : null;
  const [calling, setCalling] = useState(false);
  // "Talk to Ava" on the overview: the call opens in the right-hand column, once per ask.
  useEffect(() => {
    if (!callNonce) return;
    takeCall();
    comments?.close();
    setCalling(true);
  }, [callNonce, takeCall, comments]);
  const side: SideMode | null =
    ready && calling
      ? "call"
      : ready && comments?.panelOpen && !supportDocked // Support's dock opens chats in its own column.
        ? "comments"
        : null;
  /** Ava is the top-bar Ava, the same everywhere (4 Nov). */
  function openAssistant() {
    requestAvaOpen();
  }
  function closeSide() {
    setCalling(false);
    comments?.close();
  }
  function switchSide(mode: SideMode) {
    setCalling(false);
    if (mode === "call") return setCalling(true);
    if (page && hasChat(page.slug)) comments?.openChat(page.slug);
    else comments?.openList();
  }
  // Ava moving the document: the page she names, then her section scrolled to and lit up.
  // On phones the sheet drops to half height so the page shows above it.
  const focusRef = useRef<{ page: string; section: string | null } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  function showOnPage(show: AgentShow) {
    const target = BLUEPRINT_PAGES.find((item) => item.slug === show.page);
    if (!target) return;
    focusRef.current = { page: target.slug, section: show.section };
    setFocusNonce((n) => n + 1);
    if (target.slug !== page?.slug) router.push(href(target.href), { scroll: false });
  }
  // The top-bar Ava knows this page, whose Blueprint it is, and how to reload or move it.
  const onePage = Boolean(page && !isDocument(page.slug));
  useBlueprintAva({ page, onePage, isAdmin, onShow: showOnPage });
  const isDocumentPage = page?.slug === "blueprint";
  // The landing page draws its own full-width cover, with no page header.
  const isHome = page?.slug === "command";
  // The clean look (picked 4 Nov): each page drawn like Linear, with its chat open beside it.
  const clean = BLUEPRINT_LOOK === "clean" && Boolean(page && !isDocument(page.slug));
  // With the assistant open on a normal laptop, fold the contents to a rail so the document keeps its width.
  const showNav = navOpen && (wide || !side);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    // Follow the app sidebar's button when it moves (it shifts a little as that sidebar folds).
    let followed: HTMLElement | null = null;
    const follow = new MutationObserver(() => place());
    const place = () => {
      const main = document.querySelector<HTMLElement>(
        'button[aria-label="Collapse sidebar"], button[aria-label="Expand sidebar"]'
      );
      if (main && main !== followed) {
        follow.disconnect();
        follow.observe(main, { attributes: true, attributeFilter: ["style"] });
        followed = main;
      }
      const box = main?.getBoundingClientRect();
      const at = box && box.height ? box.top + box.height / 2 : window.innerHeight - 113;
      const top = Math.round(at - aside.getBoundingClientRect().top);
      setEdgeTop((prev) => (prev === top ? prev : top));
    };
    place();
    // The app sidebar draws its button a moment after it mounts.
    const late = window.setTimeout(place, 600);
    const watch = new ResizeObserver(place);
    watch.observe(aside);
    window.addEventListener("resize", place);
    return () => {
      window.clearTimeout(late);
      watch.disconnect();
      follow.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

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

  // The open chat follows the page: moving to another page opens that page's chat.
  const openKey = comments?.openKey ?? null;
  const panelOpen = comments?.panelOpen ?? false;
  const openList = comments?.openList;
  const openChat = comments?.openChat;
  useEffect(() => {
    if (!panelOpen || !page?.slug || !openList || !openChat) return;
    if (isDocument(page.slug)) return;
    if (!openKey || commentPage(openKey) !== page.slug) openChat(page.slug);
  }, [panelOpen, page?.slug, openKey, openList, openChat]);

  // The clean look opens the page's chat beside it on arrival, as on a Linear issue. Once: closing it sticks.
  const cleanChatOpened = useRef(false);
  useEffect(() => {
    if (!clean || cleanChatOpened.current || !ready || !page || sidePanelDesktop !== true || !openChat) return;
    cleanChatOpened.current = true;
    if (supportDocked) return;
    // A link that names a panel wins.
    if (new URLSearchParams(window.location.search).get("panel")) return;
    openChat(page.slug);
  }, [clean, ready, page, sidePanelDesktop, openChat, supportDocked]);

  // A link from Admin → Coaches → Blueprint names the panel to open (?panel=activity opens Ava, or chat), once.
  const panelAsked = useRef(false);
  useEffect(() => {
    // Wait for who's looking too: Ava's work for BCA is only for BCA.
    if (panelAsked.current || !ready || !viewerProfile || !page || isDocument(page.slug)) return;
    panelAsked.current = true;
    const panel = new URLSearchParams(window.location.search).get("panel");
    if (panel === "activity" && isAdmin) openAssistant();
    else if (panel === "chat" && !supportDocked) switchSide("comments");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page has loaded
  }, [ready, page?.slug, viewerProfile]);

  // BCA: which pages Ava has something waiting on, or could write now.
  const coachId = knowledge?.coach_id ?? null;
  const avaOpen = useAvaOpen(coachId, isAdmin);
  const avaMark = (slug: string): "open" | "ready" | null => {
    if (!isAdmin || !ready) return null;
    if (avaOpen[pageScope(slug)]) return "open";
    return avaWorkFor(pageScope(slug), { ...knowledge, payload }).ready ? "ready" : null;
  };

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
      closeSide();
      return;
    }
    setNavOpen((open) => {
      const next = !open;
      window.localStorage.setItem(NAV_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Collapsed (compact): icons only, like the app sidebar, with the name on hover.
  const navItemClass = (compact: boolean, current: boolean) =>
    `${
      compact
        ? "relative flex h-9 w-9 items-center justify-center rounded-[7px]"
        : "flex items-start gap-3 rounded-[7px] px-4 py-2.5 text-[0.9375rem] leading-snug"
    } ${
      current
        ? "bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.08)] [&_svg]:text-[#0c5290]"
        : "text-[#334155] hover:bg-white/55 hover:text-[#0f172a] [&_svg]:text-[#94a3b8]"
    }`;

  const renderNav = (compact: boolean) => (
    <nav aria-label="Practice blueprint" className="space-y-1">
      {BLUEPRINT_GROUPS.map((section) => (
        <div
          key={section.label}
          className={compact ? "border-t border-[var(--app-subnav-rule)] pt-2 first:border-t-0 first:pt-0" : "pt-3.5 first:pt-0"}
        >
          {compact ? null : (
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">
              {section.label}
            </p>
          )}
          <ul className={compact ? "flex flex-col items-center gap-0.5 pb-2" : "space-y-0.5"}>
            {section.pages.map((item) => {
              const current = path ? item.href === here : pathname === href(item.href);
              return (
                <li key={item.slug}>
                  <Link
                    href={href(item.href)}
                    scroll={stayOnPage ? false : undefined}
                    aria-current={current ? "page" : undefined}
                    data-hint-label={item.title}
                    data-hint-description={item.heading || undefined}
                    onClick={() => setDrawerOpen(false)}
                    className={navItemClass(compact, current)}
                  >
                    {compact ? (
                      <>
                        <PageIcon slug={item.slug} className="h-5 w-5 shrink-0" />
                        <span className="sr-only">{item.title}</span>
                      </>
                    ) : (
                      <>
                        <PageIcon slug={item.slug} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1">{item.title}</span>
                        <AvaNavMark mark={avaMark(item.slug)} />
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
      <div className="bp-no-print sticky top-0 z-30 border-b border-[var(--app-subnav-rule)] bg-[var(--app-subnav-bg)]/95 px-3 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-controls="practice-nav-drawer"
          className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/55"
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
            className="bp-nav-drawer absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-[var(--app-subnav-bg)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--app-subnav-rule)] px-3 py-3">
              {switcher ? (
                <div className="min-w-0 flex-1">{switcher}</div>
              ) : (
                <p className="text-[0.8125rem] font-semibold text-[#0f172a]">My Blueprint</p>
              )}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close contents"
                className="rounded-md p-1.5 text-slate-600 hover:bg-white/55 hover:text-slate-900"
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
        className={`relative hidden shrink-0 border-[var(--app-subnav-rule)] bg-[var(--app-subnav-bg)] lg:block lg:border-r ${
          embedded
            ? "lg:h-full lg:min-h-0"
            : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:max-h-[calc(100dvh-3.5rem)] lg:self-start"
        } ${
          showNav ? "lg:w-[var(--practice-nav-w)]" : "w-14"
        }`}
      >
        <div className="lg:h-full lg:overflow-y-auto lg:overscroll-y-none">
        {/* The top bar already says My Blueprint; admins keep their coach picker here. */}
        {switcher && showNav ? (
          // The same height as the page's top bar (min-h-12), so the two lines meet.
          <div className="flex h-12 items-center border-b border-[var(--app-subnav-rule)] px-3 [&>*]:flex-1">{switcher}</div>
        ) : null}
        {showNav ? <div className="px-3 py-4">{renderNav(false)}</div> : <div className="py-3">{renderNav(true)}</div>}
        </div>
        {showNav ? <NavResizer width={navWidth} onChange={setNavWidth} /> : null}
        {/* Same round button, at the same height, as the app sidebar's. */}
        <button
          type="button"
          onClick={toggleNav}
          aria-expanded={showNav}
          aria-label={showNav ? "Collapse blueprint" : "Expand blueprint"}
          style={{ top: edgeTop ?? undefined }}
          className={`absolute right-0 z-30 flex translate-x-1/2 -translate-y-1/2 ${edgeTop === null ? "invisible" : ""} ${EDGE_TOGGLE_CLASS} bg-[#64748b] hover:bg-[#475569]`}
        >
          {showNav ? (
            <ChevronLeft className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
          )}
        </button>
      </aside>
      <NavHoverHints container={asideRef} mode={showNav ? "rest" : "instant"} placement="right" enabled={sidePanelDesktop === true} />

      <section className={`bp-print-root @container flex min-w-0 flex-1 flex-col lg:basis-[51rem] print:block print:bg-white ${clean || isHome ? "bp-clean bg-white" : "app-canvas-bg"} ${embedded ? "lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-none lg:[contain:paint]" : ""}`}>
        {isHome && page ? (
          <>
            <CleanTopBar
              page={page}
              side={side}
              onSide={switchSide}
              onPage={(next) => router.push(href(next.href), { scroll: false })}
            />
            {ready ? children : <p className="px-6 py-8 text-sm text-slate-600 md:px-10 lg:px-14">{error || "Opening your blueprint…"}</p>}
          </>
        ) : clean && page ? (
          <>
            <CleanTopBar
              page={page}
              side={side}
              onSide={switchSide}
              onPage={(next) => router.push(href(next.href), { scroll: false })}
            />
            {/* Left-aligned, as in the Scripts: the text stays put when the chat opens or closes. */}
            <div className="@container w-full max-w-[51rem] px-6 pt-8 pb-24 md:px-10 lg:px-14 print:p-0">
              <header>
                {/* The page's status on the title's row, right-aligned. */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <h1 className="min-w-0 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
                    {page.title}
                  </h1>
                  {ready ? (
                    <div className="bp-no-print flex shrink-0 items-center gap-2">
                      <PageStatusControl page={page} />
                    </div>
                  ) : null}
                </div>
                <PageBlurb page={page} className="mt-2.5 max-w-[62ch] text-[1.0625rem] leading-[1.55] text-[#475569]" />
              </header>
              <div className="pt-6">
                {ready ? children : <p className="text-sm text-slate-600">{error || "Opening your blueprint…"}</p>}
              </div>
            </div>
          </>
        ) : (
        <div className="@container mx-auto w-full max-w-[54rem] px-5 pt-8 pb-10 md:px-10 md:pt-10 print:p-0">
        {isDocumentPage ? (
          <div className="bp-no-print mb-5 flex flex-wrap items-center justify-end gap-2">
            {ready ? <DownloadMenu /> : null}
            {ready && side !== "comments" ? <CommentsButton /> : null}
          </div>
        ) : (
        <header className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
            {page?.title ?? "Blueprint"}
          </h1>
          {ready && page ? (
            <div className="bp-no-print flex shrink-0 items-center gap-2">
              <PageStatusControl page={page} />
              {side !== "comments" ? <CommentsButton pageSlug={page.slug} /> : null}
            </div>
          ) : null}
          </div>
          {page ? (
            <PageBlurb page={page} className="mt-2.5 text-lg leading-[1.55] text-[#475569]" />
          ) : null}
        </header>
        )}
        <div className={isDocumentPage ? "" : "pt-8"}>
          {ready ? (
            children
          ) : (
            <p className="text-sm text-slate-600">{error || "Opening your blueprint…"}</p>
          )}
        </div>
        </div>
        )}
      </section>

      {/* Room for Support's docked chat, which sits here under the top bar. */}
      {supportDocked ? <div aria-hidden className="bp-no-print hidden w-[28rem] shrink-0 lg:block" /> : null}

      {side && sidePanelDesktop === true ? (
          <aside
            aria-label={side === "call" ? "Call with Ava" : "Chat"}
            className={`bp-no-print hidden shrink-0 flex-col border-l border-slate-200 lg:flex ${clean ? "bp-clean-side" : ""} ${side === "comments" ? "bp-chat-side" : ""} ${clean && side === "comments" ? "basis-[25rem] grow-[1000] max-w-[32rem]" : "w-[23rem]"} ${
              embedded
                ? "lg:h-full lg:min-h-0"
                : "lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:max-h-[calc(100dvh-3.5rem)] lg:self-start"
            }`}
          >
            <SidePanel mode={side} sectionKey={discussing} page={page} onClose={closeSide} />
          </aside>
      ) : null}
      {side && sidePanelDesktop === false ? (
          <div className="bp-no-print fixed inset-0 z-50 flex flex-col justify-end bg-[#051e36]/35 lg:hidden">
            <div
              className={`h-[85dvh] overflow-hidden rounded-t-3xl shadow-[0_-20px_50px_-20px_rgba(5,30,54,0.6)] ${clean ? "bp-clean-side" : ""} ${side === "comments" ? "bp-chat-side" : ""}`}
            >
              <SidePanel mode={side} sectionKey={discussing} page={page} onClose={closeSide} />
            </div>
          </div>
      ) : null}

      {/* BCA's waiting work on this page, drawn into the top-bar Ava's panel. */}
      {ready && isAdmin && page && onePage && !sample ? <PageActivity page={page} onShow={showOnPage} /> : null}
    </div>
  );
}

/**
 * The clean look's top bar, as on a Linear issue: where you are, previous and
 * next page, and the side panel buttons, so the page header holds only the
 * title, its line and its status.
 */
function CleanTopBar({
  page,
  side,
  onSide,
  onPage,
}: {
  page: BlueprintLink;
  side: SideMode | null;
  onSide: (mode: SideMode) => void;
  onPage: (page: BlueprintLink) => void;
}) {
  const pages = BLUEPRINT_PAGES.filter((item) => !isDocument(item.slug));
  const index = pages.findIndex((item) => item.slug === page.slug);
  const prev = index > 0 ? pages[index - 1] : null;
  const next = index >= 0 && index < pages.length - 1 ? pages[index + 1] : null;
  const group = BLUEPRINT_GROUPS.find((g) => g.pages.some((item) => item.slug === page.slug));
  // The Overview has a chat too, for anything not about one page.
  const onePage = hasChat(page.slug);
  const quiet =
    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";
  const arrow =
    "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="bp-no-print sticky top-0 z-20 flex min-h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-1.5 backdrop-blur md:px-5">
      <p className="flex min-w-0 items-center gap-2 text-sm">
        {group ? <span className="hidden shrink-0 text-slate-500 sm:inline">{group.label}</span> : null}
        {group ? (
          <span className="hidden select-none text-slate-300 sm:inline" aria-hidden>
            /
          </span>
        ) : null}
        <span className="min-w-0 truncate font-semibold text-slate-900">{page.title}</span>
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {onePage && side !== "comments" ? <CleanChatButton pageSlug={page.slug} onOpen={() => onSide("comments")} className={quiet} /> : null}
        {index >= 0 ? (
          <span className="ml-1 flex items-center gap-0.5 border-l border-slate-200 pl-2">
            <span className="hidden pr-1 text-caption tabular-nums text-slate-400 sm:inline">
              {index + 1} of {pages.length}
            </span>
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && onPage(prev)}
              aria-label={prev ? `Previous page: ${prev.title}` : "No previous page"}
              title={prev?.title}
              className={arrow}
            >
              <ChevronUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onPage(next)}
              aria-label={next ? `Next page: ${next.title}` : "No next page"}
              title={next?.title}
              className={arrow}
            >
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Chat, with the page's unread count, when the chat is shut. */
function CleanChatButton({ pageSlug, onOpen, className }: { pageSlug: string; onOpen: () => void; className: string }) {
  const comments = useSectionComments();
  if (!comments?.side) return null;
  const unread = Object.entries(comments.threads).reduce((n, [key, t]) => n + (commentPage(key) === pageSlug ? t.unread : 0), 0);
  return (
    <button type="button" onClick={onOpen} className={className}>
      <MessageSquare className="h-4 w-4" aria-hidden />
      Chat
      {unread ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
          {unread}
        </span>
      ) : null}
    </button>
  );
}

/** BCA only, in the contents: Ava has something waiting on this page, or could write it now. */
function AvaNavMark({ mark }: { mark: "open" | "ready" | null }) {
  if (!mark) return null;
  return (
    <Zap
      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${mark === "open" ? "fill-[#0c5290] text-[#0c5290]" : "text-[#0c5290]"}`}
      aria-label={mark === "open" ? "Ava has something for you to check" : "Ava could write this now"}
    />
  );
}
