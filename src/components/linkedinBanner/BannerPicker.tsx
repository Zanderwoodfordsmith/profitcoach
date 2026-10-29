"use client";

import { ChevronLeft, ChevronRight, Download, Loader2, Plus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { BANNER_WORD_LIMITS, type BannerField, type BannerOption } from "@/lib/linkedinBanner/designs";
import { GOOGLE_FONTS_HREF } from "@/lib/printPack/brand.js";
import { downloadPng } from "@/lib/printPack/browserExport";

import { BANNER_W, BannerSvg, type FieldBox } from "./BannerSvg";

/** Saves one banner as the PNG LinkedIn wants, fonts and all. */
export async function downloadBannerSvg(svg: SVGSVGElement, filename: string) {
  const markup = new XMLSerializer()
    .serializeToString(svg)
    .replace(/^<svg([^>]*)>/, `<svg$1><style>@import url('${GOOGLE_FONTS_HREF.replace(/&/g, "&amp;")}');</style>`);
  await downloadPng(markup, BANNER_W, filename);
}

/**
 * The chosen banner in the banner spot. While it is open, click any words to
 * type over them right there, and flick through the options with the arrows.
 */
export function BannerStage({
  option,
  discreet,
  active,
  count,
  onStep,
  onWords,
}: {
  option: BannerOption;
  discreet: boolean;
  active: boolean;
  count: number;
  onStep: (delta: number) => void;
  onWords: (field: BannerField, value: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [editing, setEditing] = useState<BannerField | null>(null);
  const [boxes, setBoxes] = useState<Record<BannerField, FieldBox> | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / BANNER_W);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Closing the banner ends any typing. (The page keys this by option, so moving to another starts fresh.)
  const field = active ? editing : null;
  const box = field && boxes ? boxes[field] : null;

  return (
    <div ref={boxRef} className="absolute inset-0">
      <BannerSvg
        option={option}
        discreet={discreet}
        editable={active}
        hiddenField={field}
        onFieldClick={setEditing}
        onLayout={setBoxes}
        className="h-full w-full"
      />
      {field && box && scale ? (
        <InlineWords
          key={field}
          value={option.words[field]}
          max={BANNER_WORD_LIMITS[field]}
          box={box}
          scale={scale}
          letterSpacing={field === "light" ? -0.8 : field === "bold" || field === "accent" ? -1.1 : 0}
          onChange={(value) => onWords(field, value)}
          onDone={() => setEditing(null)}
        />
      ) : null}
      {active && count > 1 ? (
        <>
          <StepButton side="left" onClick={() => onStep(-1)} />
          <StepButton side="right" onClick={() => onStep(1)} />
        </>
      ) : null}
    </div>
  );
}

function StepButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={side === "left" ? "Previous banner" : "Next banner"}
      className={`absolute top-1/2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--bp-ink)] shadow-[0_2px_8px_rgba(5,30,54,0.25)] hover:bg-white ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Typing straight onto the banner: sits exactly over the line it replaces. */
function InlineWords({
  value,
  max,
  box,
  scale,
  letterSpacing,
  onChange,
  onDone,
}: {
  value: string;
  max: number;
  box: FieldBox;
  scale: number;
  letterSpacing: number;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const size = box.size * box.scale * scale;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = value;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Only on opening: after that the words live in the span.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Banner words"
      spellCheck
      onInput={(e) => {
        const el = e.currentTarget;
        const text = (el.textContent ?? "").replace(/\s*\n\s*/g, " ");
        if (text.length > max) {
          el.textContent = text.slice(0, max);
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
        onChange((el.textContent ?? "").slice(0, max));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={onDone}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-[3] min-w-[2ch] whitespace-pre rounded-sm outline-dashed outline-2 outline-offset-4 outline-[#1A8FD4]"
      style={{
        left: box.x * scale,
        // Figtree's baseline sits 0.85em down a line-height-1 box.
        top: (box.y - box.size * box.scale * 0.85) * scale,
        fontFamily: "Figtree, 'Inter Tight', Inter, sans-serif",
        fontSize: size,
        fontWeight: box.weight,
        lineHeight: 1,
        letterSpacing: letterSpacing * box.scale * scale,
        color: box.color,
        caretColor: box.color,
      }}
    />
  );
}

/** The options as small boxes under the banner: pick one, download any, or add another version. */
export function BannerStrip({
  options,
  chosen,
  discreet,
  onChoose,
  onAdd,
  onRemove,
}: {
  options: BannerOption[];
  chosen: number;
  discreet: boolean;
  onChoose: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const svgs = useRef<(SVGSVGElement | null)[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(index: number) {
    const svg = svgs.current[index];
    if (!svg) return;
    setError(null);
    setDownloading(index);
    try {
      await downloadBannerSvg(svg, `linkedin-banner-${index + 1}.png`);
    } catch {
      setError("Could not make the banner image. Try again.");
    }
    setDownloading(null);
  }

  return (
    <div className="bp-no-print space-y-3 rounded-xl border border-[#e3e9f0] bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--bp-ink)]">
          Banner {chosen + 1} of {options.length}
        </p>
        <button
          type="button"
          disabled={downloading !== null}
          onClick={() => void download(chosen)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
        >
          {downloading === chosen ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
          Download for LinkedIn
        </button>
      </div>
      <p className="text-sm text-[var(--bp-muted)]">
        Click any words on the banner to change them. Use the arrows or the boxes below to see the others, then upload the one you like as your LinkedIn background photo.
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {options.map((option, i) => {
          const selected = i === chosen;
          return (
            <div key={i} className="group relative shrink-0">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`Banner ${i + 1}`}
                onClick={() => onChoose(i)}
                className={`block w-40 overflow-hidden rounded-md ring-2 transition ${
                  selected ? "ring-[var(--bp-sky)]" : "ring-[#e3e9f0] hover:ring-[#c8d9ec]"
                }`}
              >
                <BannerSvg
                  ref={(el) => {
                    svgs.current[i] = el;
                  }}
                  option={option}
                  discreet={discreet}
                  className="block h-auto w-full"
                />
              </button>
              <button
                type="button"
                onClick={() => void download(i)}
                disabled={downloading !== null}
                aria-label={`Download banner ${i + 1}`}
                title="Download"
                className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[var(--bp-ink)] shadow-[0_1px_3px_rgba(5,30,54,0.3)] hover:text-[var(--bp-blue)] disabled:opacity-50"
              >
                {downloading === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              </button>
              {options.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove banner ${i + 1}`}
                  title="Remove"
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white/95 text-[var(--bp-muted)] shadow-[0_1px_3px_rgba(5,30,54,0.3)] hover:text-[#9b1c1c] group-hover:flex"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="flex w-40 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-[#c8d9ec] text-xs font-semibold text-[var(--bp-blue)] hover:bg-[#f4f7fa]"
          style={{ aspectRatio: "1584 / 396" }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Another version
        </button>
      </div>
      {error ? <p className="text-sm text-[#9b1c1c]">{error}</p> : null}
    </div>
  );
}
