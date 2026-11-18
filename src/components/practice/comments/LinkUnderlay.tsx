"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/** A [label](url) link or a bare http(s) address, as typed in a message box. */
const LINK_SOURCE = String.raw`\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>]*[^\s<>().,;:!?'"]`;

export function hasTypedLink(text: string): boolean {
  return new RegExp(LINK_SOURCE).test(text);
}

function parts(text: string): { text: string; link: boolean }[] {
  const out: { text: string; link: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(LINK_SOURCE, "g"))) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), link: false });
    out.push({ text: m[0], link: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), link: false });
  return out;
}

const COPIED = [
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textIndent",
  "wordSpacing",
  "boxSizing",
] as const;

/**
 * Shows links blue while they're typed. A textarea can't colour part of its
 * text, so this lays a copy of the text over the box (same size, padding and
 * font, read from the box itself) with the links coloured; the box's own text
 * goes see-through while it holds a link. Clicks pass through to the box.
 * The box's parent must be `position: relative`.
 */
export function LinkUnderlay({
  boxRef,
  text,
}: {
  boxRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
}) {
  const layerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const layer = layerRef.current;
    if (!box || !layer) return;
    const sync = () => {
      const cs = getComputedStyle(box);
      for (const prop of COPIED) layer.style[prop] = cs[prop];
      // A scrollbar narrows the box's text; keep the copy wrapping the same.
      const scrollbar =
        box.offsetWidth -
        box.clientWidth -
        parseFloat(cs.borderLeftWidth) -
        parseFloat(cs.borderRightWidth);
      layer.style.paddingRight = `${parseFloat(cs.paddingRight) + Math.max(0, scrollbar)}px`;
      layer.style.top = `${box.offsetTop}px`;
      layer.style.left = `${box.offsetLeft}px`;
      layer.style.width = `${box.offsetWidth}px`;
      layer.style.height = `${box.offsetHeight}px`;
      layer.scrollTop = box.scrollTop;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(box);
    box.addEventListener("scroll", sync);
    box.addEventListener("focus", sync);
    box.addEventListener("blur", sync);
    return () => {
      ro.disconnect();
      box.removeEventListener("scroll", sync);
      box.removeEventListener("focus", sync);
      box.removeEventListener("blur", sync);
    };
  }, [boxRef, text]);

  return (
    <div
      ref={layerRef}
      aria-hidden
      className="pointer-events-none absolute overflow-hidden whitespace-pre-wrap break-words border-solid border-transparent text-[var(--bp-ink)]"
    >
      {parts(text).map((part, i) =>
        part.link ? (
          <span key={i} className="text-blue-600 underline decoration-blue-600/40 underline-offset-2">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
      {/* A trailing newline in a textarea still takes a line. */}
      {"\n"}
    </div>
  );
}
