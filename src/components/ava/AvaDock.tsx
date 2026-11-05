"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";

import { AvaChat } from "./AvaChat";
import { AvaAction, AvaRoomProvider } from "./AvaKit";
import { AvaHalo } from "./AvaHalo";
import { AvaStage } from "./AvaStage";
import { morphAva } from "./avaMorph";
import { setAvaWorkSlot } from "./avaPageLink";
import { useAvaSession } from "./useAvaSession";

/**
 * Ava everywhere, the Blueprint included (4 Nov). Opened from the top bar, she
 * floats over the right of the page (the page never moves), in the same blue
 * room as her own page. The conversation is the app's one Ava conversation,
 * so "Open full page" carries it across to her page. BCA on a coach's
 * Blueprint page gets a pinned strip under the header with what's waiting.
 */

export function AvaDock({
  fullscreen,
  onToggleFullscreen,
  onClose,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
}) {
  const {
    agent,
    convo,
    chats,
    loadChats,
    updateChat,
    deleteChat,
    transcribe,
    starters,
    moreIdeas,
    subtitle,
    admin,
    first,
    greeting,
    intro,
    placeholder,
    draft,
    setDraft,
    bcaWork,
  } = useAvaSession();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useDashboardProfile();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Her own page, for everyone (5 Nov: opened to coaches): the admin one under /admin.
  const pageHref = profile ? (pathname.startsWith("/admin") ? "/admin/ava/chat" : "/coach/ava") : null;
  useEffect(() => {
    if (pageHref) router.prefetch(pageHref);
  }, [router, pageHref]);
  const openFull = () => {
    if (!pageHref) return onToggleFullscreen();
    morphAva("open", () => {
      onClose();
      router.push(pageHref);
    });
  };

  // Escape: full screen docks (the stage handles that), docked closes.
  useEffect(() => {
    if (fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, onClose]);

  // The Blueprint draws BCA's waiting work into this strip (a portal, so it keeps its data).
  const work = bcaWork ? (
    <div ref={setAvaWorkSlot} className="relative z-[2] shrink-0 px-3 pb-2" />
  ) : null;
  useEffect(() => () => setAvaWorkSlot(null), []);

  const chat = (headerSlot: HTMLElement | null) => (
    <AvaChat
      convo={convo}
      transcribe={transcribe}
      chats={chats}
      greeting={greeting}
      intro={intro}
      starters={starters}
      footnote="Or ask me anything below."
      showCoach={admin}
      placeholder={placeholder}
      draft={draft}
      setDraft={setDraft}
      headerSlot={headerSlot}
      onHistory={loadChats}
      onNavigate={fullscreen ? onToggleFullscreen : undefined}
      compact={!fullscreen}
      first={first}
      moreIdeas={moreIdeas}
      updateChat={updateChat}
      deleteChat={deleteChat}
      onFullPage={fullscreen ? undefined : openFull}
    />
  );

  if (fullscreen) {
    return (
      <AvaStage subtitle={subtitle} onDock={onToggleFullscreen} onClose={onClose}>
        {(slot) =>
          agent ? (
            <div className="flex h-full min-h-0 flex-col">
              {work ? <div className="mx-auto w-full max-w-[46rem]">{work}</div> : null}
              <div className="min-h-0 flex-1">{chat(slot)}</div>
            </div>
          ) : null
        }
      </AvaStage>
    );
  }

  return (
    <AvaRoomProvider room="panel" dark>
      <button type="button" aria-label="Close Ava" onClick={onClose} className="fixed inset-0 z-[94] bg-[#051e36]/35 md:hidden" />
      <aside
        aria-label="Ava"
        className="ava-ui ava-dark ava-dock ava-dock-room fixed z-[95] flex flex-col overflow-hidden max-md:inset-x-0 max-md:bottom-0 max-md:h-[88dvh] max-md:rounded-t-3xl md:bottom-2 md:right-2 md:top-[calc(3.5rem+8px)] md:w-[calc(28rem-8px)] md:rounded-[18px]"
      >
        <span className="ava-glass-glow" aria-hidden />
        {/* One header (5 Nov, like Claude's app): her chats on the left, her mark and name in the middle,
            then New chat on an open chat, ⋯ (Full page; Pin, Rename, Delete) and Close. Its left and right edges line up
            with the Support and Blueprint chat column (28rem) behind it. */}
        <div className="relative z-[3] flex shrink-0 items-center gap-1 px-3 py-2.5">
          <div ref={setSlot} className="flex min-w-0 flex-1 items-center" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
            <AvaHalo size={24} dark className="ava-dock-halo" />
            <p className="text-[0.9375rem] font-semibold text-[var(--ava-ink)]">Ava</p>
          </div>
          <AvaAction iconOnly icon={<X className="h-4 w-4" aria-hidden />} label="Close Ava" onClick={onClose} />
        </div>
        {agent ? work : null}
        <div className="relative z-[1] min-h-0 flex-1">
          {agent ? (
            chat(slot)
          ) : (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--ava-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening Ava…
            </p>
          )}
        </div>
      </aside>
    </AvaRoomProvider>
  );
}
