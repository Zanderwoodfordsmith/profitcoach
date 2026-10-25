"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Maximize2, X } from "lucide-react";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";

import { AvaChat } from "./AvaChat";
import { AvaAction, AvaRoomProvider } from "./AvaKit";
import { AvaHalo } from "./AvaHalo";
import { AvaStage } from "./AvaStage";
import { useAvaSession } from "./useAvaSession";

/**
 * Ava everywhere outside the Blueprint. Opened from the top bar, she floats
 * over the right of the page (the page never moves), in the same blue room
 * as her own page. The conversation is the app's one Ava conversation, so
 * "Open full page" carries it across to her page.
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
  } = useAvaSession();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useDashboardProfile();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Admins have Ava's own page; everyone else keeps the full-screen view until it opens to coaches.
  const pageHref = profile?.role === "admin" ? (pathname.startsWith("/admin") ? "/admin/ava/chat" : "/coach/ava") : null;
  const openFull = () => {
    if (!pageHref) return onToggleFullscreen();
    onClose();
    router.push(pageHref);
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
    />
  );

  if (fullscreen) {
    return (
      <AvaStage subtitle={subtitle} onDock={onToggleFullscreen} onClose={onClose}>
        {(slot) => (agent ? chat(slot) : null)}
      </AvaStage>
    );
  }

  return (
    <AvaRoomProvider room="panel" dark>
      <button type="button" aria-label="Close Ava" onClick={onClose} className="fixed inset-0 z-[94] bg-[#051e36]/35 md:hidden" />
      <aside
        aria-label="Ava"
        className="ava-ui ava-dark ava-dock ava-dock-room fixed z-[95] flex flex-col overflow-hidden max-md:inset-x-0 max-md:bottom-0 max-md:h-[88dvh] max-md:rounded-t-3xl md:bottom-3 md:right-3 md:top-[4.25rem] md:w-[26rem] md:rounded-[24px]"
      >
        <span className="ava-glass-glow" aria-hidden />
        {/* One header: her mark, her name, the chat's title, then Chats, New chat, Open full page and Close. */}
        <div className="relative z-[1] flex shrink-0 items-center gap-2 px-4 pb-2 pt-3.5">
          <AvaHalo size={26} dark />
          <p className="shrink-0 text-[0.9375rem] font-semibold text-[var(--ava-ink)]">Ava</p>
          <div ref={setSlot} className="flex min-w-0 flex-1 items-center justify-end" />
          <span className="max-md:hidden">
            <AvaAction icon={<Maximize2 className="h-3.5 w-3.5" aria-hidden />} label="Full page" onClick={openFull} />
          </span>
          <AvaAction iconOnly icon={<X className="h-4 w-4" aria-hidden />} label="Close Ava" onClick={onClose} />
        </div>
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
