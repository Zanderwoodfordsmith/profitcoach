"use client";

import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";

/** Header phone button: hover (or tap) opens a glass card to call, WhatsApp or email Paul. */
export function NavContact({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);
  const lastPointer = useRef("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // Mouse only: a short delay lets the pointer cross the gap between the button and the card.
  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    if (next) setOpen(true);
    else closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <div
      ref={wrap}
      className={`v5-contact${open ? " is-open" : ""}`}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onBlur={(e) => !wrap.current?.contains(e.relatedTarget as Node) && setOpen(false)}
    >
      <button
        type="button"
        className="v5-nav-call"
        aria-expanded={open}
        aria-controls="v5-contact-panel"
        aria-label="Call, WhatsApp or email Paul"
        onPointerDown={(e) => (lastPointer.current = e.pointerType)}
        onClick={() => {
          // A mouse click lands on a card hover already opened, so keep it open; a tap or Enter toggles.
          const mouse = lastPointer.current === "mouse";
          lastPointer.current = "";
          setOpen((o) => (mouse ? true : !o));
        }}
      >
        <Phone aria-hidden />
      </button>
      <div
        id="v5-contact-panel"
        className="v5-contact-panel"
        onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}
      >
        {children}
      </div>
    </div>
  );
}
