"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { TargetLineCard, bandGradient, targetAt } from "./TargetLineCard";
import type { TargetLine } from "@/lib/profitTargets";

type Props = {
  label: string;
  /** Where we are: the dot. */
  value: number | null;
  /** Where we really are, when the dot has been dragged away from it: a faint marker, with the gap drawn between. */
  from?: number;
  /** The two lines that make the Poor, Okay and Good bands. */
  line: TargetLine;
  range: { min: number; max: number; step: number };
  lowerIsBetter: boolean;
  /** Absent for a result worked out from the rows above, so its dot can't be dragged. */
  onChange?: (value: number) => void;
  format: (value: number) => string;
  /** False: no card opens on hover (the public page sets targets in a box instead). */
  card?: boolean;
  /** Present when the lines themselves can be moved and saved, from the card that opens on hover. */
  edit?: {
    defaultLine: TargetLine;
    onDraft: (line: TargetLine) => void;
    onSave: (line: TargetLine | null) => Promise<string | null>;
  };
};

/** Hovering this long opens the card, so passing over a bar doesn't. */
const OPEN_AFTER_MS = 450;
const CLOSE_AFTER_MS = 250;

/**
 * One step as a bar: red, amber and green bands from its two lines, and the dot is us. Dragging the dot is a
 * what-if. Resting on the bar opens a card naming the bands, where the lines can be moved.
 */
export function TargetSlider({ label, value, from, line, range, lowerIsBetter, onChange, format, edit, card = true }: Props) {
  const { min, max, step } = range;
  const wrap = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const open = () => {
    if (!card) return;
    window.clearTimeout(closeTimer.current);
    if (anchor) return;
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      if (wrap.current) setAnchor(wrap.current.getBoundingClientRect());
    }, OPEN_AFTER_MS);
  };
  const close = () => {
    window.clearTimeout(openTimer.current);
    if (dragging.current) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setAnchor(null), CLOSE_AFTER_MS);
  };

  useEffect(() => {
    if (!anchor) return;
    const shut = () => setAnchor(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") shut();
    };
    const release = () => {
      dragging.current = false;
    };
    window.addEventListener("scroll", shut, { passive: true, capture: true });
    window.addEventListener("keydown", key);
    window.addEventListener("pointerup", release);
    return () => {
      window.removeEventListener("scroll", shut, { capture: true });
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerup", release);
    };
  }, [anchor]);

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Better is always on the right, so a cost's dot runs from high on the left to low on the right.
  const along = (at: number) => {
    const share = Math.min(Math.max((at - min) / (max - min), 0), 1);
    return lowerIsBetter ? 1 - share : share;
  };
  const fraction = value !== null ? along(value) : null;
  // A what-if: the real value stays as a faint marker and the gap to the dragged dot is drawn, until Reset.
  const fromFraction = from !== undefined && value !== null && Math.abs(from - value) > 1e-9 ? along(from) : null;
  const gap =
    fromFraction !== null && fraction !== null
      ? { left: Math.min(fromFraction, fraction), width: Math.abs(fraction - fromFraction) }
      : null;
  const across = (share: number) => `calc(8px + (100% - 16px) * ${share.toFixed(4)})`;
  const style = {
    "--target": targetAt(line.good, min, max, lowerIsBetter),
    "--bands": bandGradient(line, min, max, lowerIsBetter),
  } as CSSProperties;

  return (
    <span
      ref={wrap}
      className="tgt-bar"
      style={style}
      onPointerEnter={open}
      onPointerLeave={close}
      onFocus={open}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      {gap && fromFraction !== null ? (
        <>
          <span
            className="tgt-bar__gap"
            style={{ left: across(gap.left), width: `calc((100% - 16px) * ${gap.width.toFixed(4)})` }}
            aria-hidden="true"
          />
          <span className="tgt-bar__from" style={{ left: across(fromFraction) }} aria-hidden="true" />
        </>
      ) : null}
      {onChange ? (
        <input
          type="range"
          className={gap ? "is-moved" : undefined}
          dir={lowerIsBetter ? "rtl" : undefined}
          min={min}
          max={max}
          step={step}
          value={value ?? line.good}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={`${label}: try another value`}
          aria-valuetext={value !== null ? format(value) : undefined}
        />
      ) : fraction !== null ? (
        <span className="tgt-bar__dot" style={{ left: across(fraction) }} aria-hidden="true" />
      ) : null}
      {anchor ? (
        <TargetLineCard
          label={label}
          line={line}
          range={range}
          lowerIsBetter={lowerIsBetter}
          format={format}
          anchor={anchor}
          edit={edit}
          onPointerEnter={open}
          onPointerLeave={close}
          onDragging={(on) => {
            dragging.current = on;
          }}
        />
      ) : null}
    </span>
  );
}
