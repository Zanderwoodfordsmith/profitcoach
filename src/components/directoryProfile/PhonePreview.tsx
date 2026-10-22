"use client";

import { useEffect, useState } from "react";

const SCREEN = { w: 390, h: 844 };
const BEZEL = 14;

/**
 * The live page in an iPhone-sized frame. It is the real page in a 390px
 * window, so the phone layout is exactly what visitors get, and it scrolls.
 */
export function PhonePreview({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Fit the phone between the top of the window and the bottom bar.
    const fit = () => setScale(Math.min(1, (window.innerHeight - 140) / (SCREEN.h + BEZEL * 2)));
    fit();
    window.addEventListener("resize", fit);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const outer = { w: SCREEN.w + BEZEL * 2, h: SCREEN.h + BEZEL * 2 };

  return (
    <div className="dp-phone-stage" onClick={onClose} role="dialog" aria-label="Phone preview">
      <div
        className="dp-phone-fit"
        style={{ width: outer.w * scale, height: outer.h * scale }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="dp-phone"
          style={{ width: outer.w, height: outer.h, padding: BEZEL, transform: `scale(${scale})` }}
        >
          <div className="dp-phone__screen">
            <span className="dp-phone__status" aria-hidden>
              9:41
              <span className="dp-phone__island" />
            </span>
            <iframe src={src} title="Your page on a phone" />
          </div>
        </div>
      </div>
    </div>
  );
}
