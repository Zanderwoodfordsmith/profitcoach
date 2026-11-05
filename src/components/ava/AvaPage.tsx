"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, PanelRight, SquarePen } from "lucide-react";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useDashboardChrome } from "@/contexts/DashboardChromeContext";

import { AvaChat } from "./AvaChat";
import { AvaAction, AvaChatList, AvaMenuIcon, AvaRoomProvider } from "./AvaKit";
import { morphAva } from "./avaMorph";
import { avaReturnPath, requestAvaOpen } from "./avaPageLink";
import { AvaRoomBackground } from "./AvaStage";
import { useAvaSession } from "./useAvaSession";

const PANEL_KEY = "ava-chats-panel";
const WIDTH_KEY = "ava-chats-width";
// The chats panel's width in pixels: drag its right edge, double-click to reset.
const PANEL_W = 264;
const PANEL_MIN = 224;
const PANEL_MAX = 400;
const clampWidth = (w: number) => Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, w)));

/**
 * Ava's own page, inside the app: the sidebar stays, the room fills the
 * rest. No top bar here; her chats sit in a panel on the left, like every
 * other AI app. Open to coaches too since 5 Nov (the same Ava as the top-right panel).
 */
export function AvaPage() {
  const { profileLoading } = useDashboardProfile();
  const chrome = useDashboardChrome();
  const claimChromeHost = chrome?.claimChromeHost;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Open on a wide screen the first time, then however it was left. The page
  // renders nothing until the profile loads, so this only runs in the browser.
  const [panelOpen, setPanelOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(PANEL_KEY);
    } catch {
      /* private window */
    }
    return saved ? saved === "1" : window.innerWidth >= 1280;
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return PANEL_W;
    let saved = NaN;
    try {
      saved = Number(window.localStorage.getItem(WIDTH_KEY));
    } catch {
      /* private window */
    }
    return saved ? clampWidth(saved) : PANEL_W;
  });
  const router = useRouter();
  const pathname = usePathname();
  const session = useAvaSession();
  const { convo, chats, setDraft } = session;

  // Her page has no top bar: claiming the chrome keeps the app's fallback bar away.
  useEffect(() => claimChromeHost?.(), [claimChromeHost]);

  const setPanel = (open: boolean) => {
    setPanelOpen(open);
    try {
      window.localStorage.setItem(PANEL_KEY, open ? "1" : "0");
    } catch {
      /* private window */
    }
  };

  const saveWidth = (w: number) => {
    const next = clampWidth(w);
    setPanelWidth(next);
    try {
      window.localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      /* private window */
    }
  };

  // Drag the panel's right edge; the width is kept once you let go.
  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    let latest = startW;
    const body = document.body.style;
    const previous = { cursor: body.cursor, userSelect: body.userSelect };
    body.cursor = "col-resize";
    body.userSelect = "none";
    const move = (ev: globalThis.PointerEvent) => {
      latest = clampWidth(startW + ev.clientX - startX);
      setPanelWidth(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      body.cursor = previous.cursor;
      body.userSelect = previous.userSelect;
      saveWidth(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const resizeByKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      saveWidth(panelWidth + (e.key === "ArrowRight" ? 16 : -16));
    }
  };

  // On a phone the panel covers the page, so it closes once a chat is picked.
  const closeIfNarrow = () => {
    if (window.innerWidth < 768) setPanelOpen(false);
  };

  const openChat = (id: string) => {
    void convo.openChat(id);
    closeIfNarrow();
  };

  const newChat = () => {
    convo.newChat();
    setDraft("");
    closeIfNarrow();
  };

  // Same chat, now in the side panel, back on the page you came from (or Home).
  const back = avaReturnPath() ?? (pathname.startsWith("/admin") ? "/admin" : "/coach");
  useEffect(() => router.prefetch(back), [router, back]);
  const moveToSide = () =>
    morphAva("dock", () => {
      requestAvaOpen();
      router.push(back);
    });

  if (profileLoading) return null;

  return (
    <AvaRoomProvider room="stage">
      <div className="ava-ui ava-dark ava-stage is-page" aria-label="Ava">
        <div className="relative z-[1] flex min-h-0 flex-1">
          {panelOpen ? (
            <>
              <button type="button" aria-label="Close your chats" onClick={() => setPanel(false)} className="ava-chats-backdrop md:hidden" />
              <aside
                className="ava-chats-panel"
                aria-label="Your chats"
                style={{ "--ava-chats-w": `${panelWidth}px` } as CSSProperties}
              >
                <div className="flex items-center gap-2 px-3 pb-3 pt-4">
                  <button type="button" onClick={() => setPanel(false)} className="ava-glass-btn" aria-label="Hide your chats" title="Hide your chats">
                    <AvaMenuIcon />
                  </button>
                  <span className="text-[0.9375rem] font-semibold text-[var(--ava-ink)]">Chats</span>
                </div>
                <div className="px-3 pb-3">
                  <button type="button" onClick={newChat} className="ava-glass-btn is-labelled w-full justify-start">
                    <SquarePen className="h-4 w-4" aria-hidden /> New chat
                  </button>
                </div>
                <nav className="ava-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6" aria-label="Past chats">
                  {chats === null ? (
                    <p className="flex items-center gap-2 px-2 text-sm text-[var(--ava-muted)]">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
                    </p>
                  ) : chats.length === 0 ? (
                    <p className="whitespace-normal px-2 text-sm leading-6 text-[var(--ava-muted)]">Your chats with Ava will be here, each with its own title.</p>
                  ) : (
                    <AvaChatList chats={chats} currentId={convo.chatId} onOpen={openChat} />
                  )}
                </nav>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Chats panel width"
                  aria-valuemin={PANEL_MIN}
                  aria-valuemax={PANEL_MAX}
                  aria-valuenow={panelWidth}
                  tabIndex={0}
                  title="Drag to resize. Double-click to reset."
                  onPointerDown={startResize}
                  onDoubleClick={() => saveWidth(PANEL_W)}
                  onKeyDown={resizeByKey}
                  className="ava-chats-resize"
                />
              </aside>
            </>
          ) : null}

          {/* Her face belongs to the chat area, so opening the panel never pushes the words over it. */}
          <div className="ava-room-column flex min-w-0 flex-1 flex-col">
            <AvaRoomBackground face />
            <header className="relative z-[2] flex shrink-0 items-center gap-2 px-4 pb-1 pt-4 sm:px-8">
              {panelOpen ? null : (
                <button type="button" onClick={() => setPanel(true)} className="ava-glass-btn is-labelled" aria-label="Show your chats">
                  <AvaMenuIcon /> Chats
                </button>
              )}
              <div ref={setSlot} className="flex min-w-0 flex-1 items-center justify-end gap-2" />
              <AvaAction showLabel icon={<PanelRight className="h-4 w-4" aria-hidden />} label="Side panel" onClick={moveToSide} />
            </header>
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
              {session.agent ? (
                <AvaChat
                  convo={convo}
                  transcribe={session.transcribe}
                  chats={chats}
                  greeting={session.greeting}
                  first={session.first}
                  intro={session.intro}
                  starters={session.starters}
                  footnote="Or ask me anything below."
                  showCoach={session.admin}
                  placeholder={session.placeholder}
                  draft={session.draft}
                  setDraft={setDraft}
                  headerSlot={slot}
                  onHistory={session.loadChats}
                  updateChat={session.updateChat}
                  deleteChat={session.deleteChat}
                  labelled
                  heroStyle="face"
                />
              ) : (
                <p className="flex items-center gap-2 px-8 py-10 text-sm text-[var(--ava-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening Ava…
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AvaRoomProvider>
  );
}
