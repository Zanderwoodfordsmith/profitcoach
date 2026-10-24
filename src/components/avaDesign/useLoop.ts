"use client";

import { useEffect, useRef } from "react";

export type AvaState = "idle" | "listening" | "thinking" | "speaking";

/** How lively each state is, 0 to 1. Every symbol reads this. */
export const ENERGY: Record<AvaState, number> = {
  idle: 0.25,
  listening: 0.55,
  thinking: 1,
  speaking: 0.7,
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A made-up voice level for the demos: syllables and pauses, 0 to 1.
 * Real calls feed the same number from the audio stream.
 */
export function fakeVoice(t: number, on: boolean) {
  if (!on) return 0;
  const syllable = Math.max(0, Math.sin(t * 9.1) * 0.5 + Math.sin(t * 13.7 + 1.3) * 0.35 + Math.sin(t * 3.3) * 0.3);
  const phrase = Math.sin(t * 0.9) > -0.55 ? 1 : 0.1;
  return Math.min(1, syllable * phrase);
}

/**
 * Runs `draw` every frame while the canvas is on screen, at device pixel
 * ratio. Energy eases toward its target so state changes glide.
 */
export function useCanvasLoop(
  draw: (ctx: CanvasRenderingContext2D, size: number, t: number, energy: number, voice: number) => void,
  state: AvaState,
) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  const target = useRef(ENERGY[state]);
  const voiceOn = useRef(state === "speaking" || state === "listening");
  drawRef.current = draw;
  target.current = ENERGY[state];
  voiceOn.current = state === "speaking" || state === "listening";

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visible = true;
    let energy = target.current;
    const start = performance.now();
    const still = prefersReducedMotion();

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const css = canvas.clientWidth;
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    function frame(now: number) {
      raf = 0;
      if (!visible || !canvas || !ctx) return;
      const t = still ? 2 : (now - start) / 1000;
      energy += (target.current - energy) * 0.05;
      const size = canvas.clientWidth;
      ctx.clearRect(0, 0, size, size);
      drawRef.current(ctx, size, t, energy, fakeVoice(t, voiceOn.current));
      if (!still) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return ref;
}
