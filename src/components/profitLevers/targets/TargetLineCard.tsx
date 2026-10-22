"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { lineFor, type TargetLine } from "@/lib/profitTargets";

type Props = {
  label: string;
  line: TargetLine;
  range: { min: number; max: number; step: number };
  lowerIsBetter: boolean;
  format: (value: number) => string;
  /** Where the card sits, from the bar it belongs to. */
  anchor: DOMRect;
  /** Present when the lines can be moved and saved. */
  edit?: {
    defaultLine: TargetLine;
    /** Live while dragging, so the table follows. */
    onDraft: (line: TargetLine) => void;
    /** Null line means back to default. Resolves to an error message, or null. */
    onSave: (line: TargetLine | null) => Promise<string | null>;
  };
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onDragging: (dragging: boolean) => void;
};

const CARD_WIDTH = 320;
/** The handles are 10px wide; the bands line up with their centres. */
const HANDLE_HALF = 5;
/** Keyboard moves save this long after the last key press; a drag saves when the handle is let go. */
const SAVE_AFTER_MS = 600;

/** Where a value sits on a bar. Better is always on the right, so cost bars run high to low. */
export function targetAt(target: number, min: number, max: number, lowerIsBetter: boolean, inset = 8): string {
  const share = Math.min(Math.max((target - min) / (max - min), 0), 1);
  const fraction = lowerIsBetter ? 1 - share : share;
  return `calc(${inset}px + (100% - ${inset * 2}px) * ${fraction.toFixed(4)})`;
}

/** Red, amber and green from the one target: amber is the 20% just short of it, green the target and better. */
export function bandGradient(line: TargetLine, min: number, max: number, lowerIsBetter: boolean, inset = 8): string {
  const at = (value: number) => targetAt(value, min, max, lowerIsBetter, inset);
  const red = "rgba(220, 38, 38, 0.2)";
  const amber = "rgba(245, 196, 0, 0.42)";
  const green = "rgba(22, 163, 74, 0.26)";
  return `linear-gradient(to right, ${red} 0 ${at(line.poor)}, ${amber} ${at(line.poor)} ${at(line.good)}, ${green} ${at(line.good)} 100%)`;
}

/** The three bands in words, from the one target: "Off target under 43%", "Close 43% to 50%", "On target 50% and up". */
function bandWords(line: TargetLine, lowerIsBetter: boolean, format: (value: number) => string) {
  return lowerIsBetter
    ? [
        { tone: "poor", name: "Off target", range: `over ${format(line.poor)}` },
        { tone: "okay", name: "Close", range: `${format(line.good)} to ${format(line.poor)}` },
        { tone: "good", name: "On target", range: `${format(line.good)} or less` },
      ]
    : [
        { tone: "poor", name: "Off target", range: `under ${format(line.poor)}` },
        { tone: "okay", name: "Close", range: `${format(line.poor)} to ${format(line.good)}` },
        { tone: "good", name: "On target", range: `${format(line.good)} and up` },
      ];
}

/**
 * The card that opens over a bar: the target, the Close band 15% either side of it, and, where the target can be
 * edited, one handle to drag it. Nothing is saved: it lasts while the page is open.
 */
export function TargetLineCard({
  label,
  line,
  range,
  lowerIsBetter,
  format,
  anchor,
  edit,
  onPointerEnter,
  onPointerLeave,
  onDragging,
}: Props) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const lastSaved = useRef<TargetLine>(line);
  const pressing = useRef(false);
  const pending = useRef<TargetLine | null>(null);
  const { min, max, step } = range;


  const save = (next: TargetLine | null, delay = SAVE_AFTER_MS) => {
    if (!edit) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setState("saving");
      const error = await edit.onSave(next);
      if (error) {
        setState("error");
        setMessage(error);
        edit.onDraft(lastSaved.current);
        return;
      }
      lastSaved.current = next ?? edit.defaultLine;
      setState("saved");
    }, delay);
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // A drag saves once, when the handle is let go, not at every pause.
  useEffect(() => {
    const release = () => {
      if (!pressing.current) return;
      pressing.current = false;
      if (pending.current) {
        saveRef.current(pending.current, 0);
        pending.current = null;
      }
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.clearTimeout(timer.current);
    };
  }, []);

  const move = (value: number) => {
    if (!edit) return;
    const next = lineFor(value, lowerIsBetter);
    edit.onDraft(next);
    if (pressing.current) pending.current = next;
    else save(next);
  };

  const left = Math.min(Math.max(anchor.left + anchor.width / 2 - CARD_WIDTH / 2, 12), window.innerWidth - CARD_WIDTH - 12);
  const below = anchor.bottom + 8 + 190 < window.innerHeight;
  const style: CSSProperties = {
    left,
    width: CARD_WIDTH,
    ...(below ? { top: anchor.bottom + 8 } : { bottom: window.innerHeight - anchor.top + 8 }),
  };
  const words = bandWords(line, lowerIsBetter, format);
  const isDefault = edit ? Math.abs(line.good - edit.defaultLine.good) < 1e-9 : true;

  return (
    <div
      className="tgt-linecard"
      role="dialog"
      aria-label={`${label}: target`}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={() => {
        pressing.current = true;
        onDragging(true);
      }}
    >
      <p className="tgt-linecard__title">{label}</p>
      <div className="tgt-linecard__bar" style={
          {
            "--target": targetAt(line.good, min, max, lowerIsBetter, HANDLE_HALF),
            "--bands": bandGradient(line, min, max, lowerIsBetter, HANDLE_HALF),
          } as CSSProperties
        }>
        {edit ? (
          <input
            type="range"
            dir={lowerIsBetter ? "rtl" : undefined}
            min={min}
            max={max}
            step={step}
            value={line.good}
            onChange={(event) => move(Number(event.target.value))}
            aria-label={`${label}: target`}
            aria-valuetext={format(line.good)}
          />
        ) : null}
      </div>
      <div className="tgt-linecard__scale" aria-hidden="true">
        <span>{format(lowerIsBetter ? max : min)}</span>
        <span>{format(lowerIsBetter ? min : max)}</span>
      </div>
      <ul className="tgt-linecard__bands">
        {words.map((word) => (
          <li key={word.name} className={`tgt-linecard__band is-${word.tone}`}>
            <span className="tgt-linecard__name">{word.name}</span>
            <span className="tgt-linecard__range">{word.range}</span>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="tgt-linecard__foot">
          <span className={state === "error" ? "tgt-linecard__state is-error" : "tgt-linecard__state"} aria-live="polite">
            {state === "saving"
              ? "Saving…"
              : state === "saved"
                ? "Target moved"
                : state === "error"
                  ? message
                  : "Drag the handle to move the target."}
          </span>
          {!isDefault ? (
            <button
              type="button"
              className="tgt-linecard__reset"
              onClick={() => {
                edit.onDraft(edit.defaultLine);
                save(null, 0);
              }}
            >
              Back to default
            </button>
          ) : null}
        </div>
      ) : (
        <p className="tgt-linecard__note">Worked out from the rows above, so it can&rsquo;t be moved here.</p>
      )}
    </div>
  );
}
