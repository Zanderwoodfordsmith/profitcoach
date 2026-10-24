"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Minimize2, X } from "lucide-react";

import { AvaAction, AvaRoomProvider } from "./AvaKit";
import { AvaHalo } from "./AvaHalo";

/** Her face, fading into the room while the conversation is empty. Placeholder until Zander picks the face. */
const AVA_FACE_WIDE = "/ava/face-wide.webp";

/**
 * Ava full screen: her own room in a brand blue, her face fading in on the
 * right until the conversation starts (chosen 24 Oct 2026, start screen E).
 * The conversation inside is the same one as in the side panel; it hands
 * its title and History / New into the header slot.
 */
/** Ava's room: the blue, her face (while the conversation is empty), the shade and the light. */
export function AvaRoomBackground() {
  return (
    <div className="ava-stage-bg" aria-hidden>
      <span className="ava-room-dust" />
      <span className="ava-room-face" style={{ backgroundImage: `url(${AVA_FACE_WIDE})` }} />
      <span className="ava-room-scrim" />
      <span className="ava-room-glow" />
    </div>
  );
}

export function AvaStage({
  subtitle,
  onDock,
  onClose,
  children,
}: {
  subtitle: string;
  onDock: () => void;
  onClose: () => void;
  children: (headerSlot: HTMLElement | null) => ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) onDock();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDock]);

  // Only ever opened by a click, so the document is there.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AvaRoomProvider room="stage">
      <div className="ava-ui ava-stage" role="dialog" aria-modal="true" aria-label="Ava">
        <AvaRoomBackground />
        <header className="relative z-[2] flex shrink-0 items-center gap-3 px-4 pb-2 pt-4 sm:px-8">
          <div className="flex shrink-0 items-center gap-2.5">
            <AvaHalo size={30} dark />
            <span className="leading-tight">
              <span className="block text-[0.9375rem] font-bold tracking-[-0.01em] text-[var(--ava-ink)]">Ava</span>
              <span className="block max-w-[11rem] truncate text-[0.6875rem] font-semibold tracking-[0.04em] text-[var(--ava-muted)]">
                {subtitle}
              </span>
            </span>
          </div>
          <div ref={setSlot} className="flex min-w-0 flex-1 items-center justify-end gap-2" />
          <AvaAction icon={<Minimize2 className="h-4 w-4" aria-hidden />} label="Back to the side panel" onClick={onDock} />
          <AvaAction icon={<X className="h-4 w-4" aria-hidden />} label="Close Ava" onClick={onClose} />
        </header>
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children(slot)}</div>
      </div>
    </AvaRoomProvider>,
    document.body
  );
}
