"use client";

import { useEffect, useState } from "react";
import { Loader2, PanelLeft, Plus } from "lucide-react";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useDashboardChrome } from "@/contexts/DashboardChromeContext";

import { AvaChat } from "./AvaChat";
import { AvaRoomProvider, groupByDay } from "./AvaKit";
import { AvaRoomBackground } from "./AvaStage";
import { useAvaSession } from "./useAvaSession";

const PANEL_KEY = "ava-chats-panel";

/**
 * Ava's own page, inside the app: the sidebar stays, the room fills the
 * rest. No top bar here; her chats sit in a panel on the left, like every
 * other AI app. Admin-only until she opens to coaches (roadmap job 137).
 */
export function AvaPage() {
  const { profile, profileLoading } = useDashboardProfile();
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

  if (profileLoading) return null;
  if (profile?.role !== "admin") {
    return <p className="px-6 py-10 text-sm text-slate-600">Ava&apos;s page is coming soon.</p>;
  }

  return (
    <AvaRoomProvider room="stage">
      <div className="ava-ui ava-stage is-page" aria-label="Ava">
        <div className="relative z-[1] flex min-h-0 flex-1">
          {panelOpen ? (
            <>
              <button type="button" aria-label="Close your chats" onClick={() => setPanel(false)} className="ava-chats-backdrop md:hidden" />
              <aside className="ava-chats-panel" aria-label="Your chats">
                <div className="flex items-center gap-2 px-3 pb-3 pt-4">
                  <button type="button" onClick={() => setPanel(false)} className="ava-glass-btn" aria-label="Hide your chats" title="Hide your chats">
                    <PanelLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="text-[0.9375rem] font-semibold text-[var(--ava-ink)]">Chats</span>
                </div>
                <div className="px-3 pb-3">
                  <button type="button" onClick={newChat} className="ava-glass-btn is-labelled w-full justify-start">
                    <Plus className="h-4 w-4" aria-hidden /> New chat
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
                    groupByDay(chats).map((group) => (
                      <section key={group.label} className="mb-4">
                        <h3 className="px-2 pb-1 text-xs font-semibold text-[var(--ava-faint)]">{group.label}</h3>
                        <ul>
                          {group.chats.map((chat) => (
                            <li key={chat.id}>
                              <button
                                type="button"
                                onClick={() => openChat(chat.id)}
                                aria-current={convo.chatId === chat.id ? "true" : undefined}
                                className="ava-chat-row"
                              >
                                {chat.title || "Conversation"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))
                  )}
                </nav>
              </aside>
            </>
          ) : null}

          {/* Her face belongs to the chat area, so opening the panel never pushes the words over it. */}
          <div className="ava-room-column flex min-w-0 flex-1 flex-col">
            <AvaRoomBackground />
            <header className="relative z-[2] flex shrink-0 items-center gap-2 px-4 pb-1 pt-4 sm:px-8">
              {panelOpen ? null : (
                <button type="button" onClick={() => setPanel(true)} className="ava-glass-btn is-labelled" aria-label="Show your chats">
                  <PanelLeft className="h-4 w-4" aria-hidden /> Chats
                </button>
              )}
              <div ref={setSlot} className="flex min-w-0 flex-1 items-center justify-end gap-2" />
            </header>
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
              {session.agent ? (
                <AvaChat
                  convo={convo}
                  transcribe={session.transcribe}
                  chats={chats}
                  greeting={session.greeting}
                  intro={session.intro}
                  starters={session.starters}
                  footnote="Or ask me anything below."
                  showCoach={session.admin}
                  placeholder={session.placeholder}
                  draft={session.draft}
                  setDraft={setDraft}
                  headerSlot={slot}
                  onHistory={session.loadChats}
                  labelled
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
