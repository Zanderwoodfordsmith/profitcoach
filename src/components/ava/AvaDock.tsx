"use client";

import { useEffect } from "react";
import { Loader2, Maximize2, X } from "lucide-react";

import { AvaChat } from "./AvaChat";
import { AvaAction, AvaRoomProvider } from "./AvaKit";
import { AvaHalo } from "./AvaHalo";
import { AvaStage } from "./AvaStage";
import { useAvaSession } from "./useAvaSession";

/**
 * Ava everywhere outside the Blueprint. Opened from the top bar, she floats
 * over the right of the page (the page never moves) and can go full screen.
 * Same conversation, same parts, as Ava in the Blueprint.
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
  const { agent, convo, chats, loadChats, transcribe, starters, subtitle, admin, greeting, intro, placeholder, draft, setDraft } =
    useAvaSession();

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
    <AvaRoomProvider room="panel">
      <button type="button" aria-label="Close Ava" onClick={onClose} className="fixed inset-0 z-[94] bg-[#051e36]/35 md:hidden" />
      <aside
        aria-label="Ava"
        className="ava-ui ava-dock fixed z-[95] flex flex-col overflow-hidden ava-glass-panel max-md:inset-x-0 max-md:bottom-0 max-md:h-[88dvh] max-md:rounded-t-3xl max-md:shadow-[0_-20px_50px_-20px_rgba(5,30,54,0.6)] md:bottom-3 md:right-3 md:top-[4.25rem] md:w-[26rem] md:rounded-[24px]"
      >
        <span className="ava-glass-glow" aria-hidden />
        <div className="relative z-[1] flex shrink-0 items-center gap-2.5 border-b border-[var(--ava-rule)] px-4 py-3">
          <AvaHalo size={28} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold text-[var(--ava-ink)]">Ava</p>
            <p className="truncate text-xs text-[var(--ava-faint)]">{subtitle}</p>
          </div>
          <span className="max-md:hidden">
            <AvaAction iconOnly icon={<Maximize2 className="h-4 w-4" aria-hidden />} label="Full screen" onClick={onToggleFullscreen} />
          </span>
          <AvaAction iconOnly icon={<X className="h-4 w-4" aria-hidden />} label="Close Ava" onClick={onClose} />
        </div>
        <div className="relative z-[1] min-h-0 flex-1">
          {agent ? (
            chat(null)
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
