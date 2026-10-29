"use client";

import { Map as MapIcon, ChartPie, Search, ShieldCheck, Target, Wrench, type LucideIcon } from "lucide-react";
import { forwardRef, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { bannerDesign, type BannerField, type BannerOption } from "@/lib/linkedinBanner/designs";
import { logo } from "@/lib/printPack/brand.js";

/** LinkedIn's banner size. Everything below is in these units. */
export const BANNER_W = 1584;
export const BANNER_H = 396;

const FONT = "Figtree, 'Inter Tight', Inter, sans-serif";
const C = {
  ink: "#0F1B2D",
  slate: "#5B6B7F",
  navy: "#0C5290",
  blue: "#42A1EE",
  teal: "#1CA0C2",
  sky: "#1A8FD4",
  deep: "#051E36",
  ground: "#F6F8FB",
  foundation: "#4C667A",
};
const HOT = { red: "#E5484D", orange: "#F97316" };

/** Copy starts right of the profile photo, which covers the bottom-left. */
const COPY_X = 500;
/** Where each line sits (baselines), and how big it is. */
export const LINE = {
  eyebrow: { y: 109, size: 22, weight: 600 },
  light: { y: 174, size: 54, weight: 300 },
  bold: { y: 231, size: 54, weight: 700 },
  cta: { y: 291, size: 18, weight: 600 },
} as const;
const PILL = { y: 262, h: 46, pad: 24, arrow: 26 };

type Card = { label: string; when?: string; tagline: [string, string]; col: string; colDark: string; Icon: LucideIcon };

const OFFER: Card[] = [
  { label: "Get clear", when: "Month 1", tagline: ["Score it and find", "the real cause"], col: C.navy, colDark: "#093f70", Icon: Search },
  { label: "Fix what matters", when: "Months 2 and 3", tagline: ["The right few fixes,", "done properly"], col: C.blue, colDark: "#2b86d3", Icon: Wrench },
  { label: "Make it last", when: "From month 4", tagline: ["Score again", "every 90 days"], col: C.teal, colDark: "#14829f", Icon: ShieldCheck },
];
const SCORE: Card[] = [
  { label: "Score", tagline: ["10 areas, scored", "out of 100"], col: C.navy, colDark: "#093f70", Icon: ChartPie },
  { label: "Review", tagline: ["Find the one thing", "holding you back"], col: C.blue, colDark: "#2b86d3", Icon: Target },
  { label: "Plan", tagline: ["The right few", "fixes, in order"], col: C.teal, colDark: "#14829f", Icon: MapIcon },
];

const CARD = { w: 168, h: 200, gap: 14, bar: 56 };
const CARDS_X = BANNER_W - 40 - (3 * CARD.w + 2 * CARD.gap);
const CARDS_Y = (BANNER_H - CARD.h) / 2;

const WHEEL = { size: 560, focus: 7 };
const WHEEL_X = BANNER_W + 150 - WHEEL.size;
const WHEEL_Y = (BANNER_H - WHEEL.size) / 2;
/** Where the words must stop so they never run into the picture. */
const WORDS_END = { offer: CARDS_X - 24, score: CARDS_X - 24, wheel: 1150 };

/** Where an editable line sits, in banner units, after any shrinking. */
export type FieldBox = { x: number; y: number; size: number; weight: number; color: string; scale: number };

type Widths = { eyebrow: number; light: number; bold: number; boldPart: number; cta: number; note: number };

function scaleAt(x: number, y: number, k: number) {
  return k === 1 ? undefined : `translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`;
}

function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (r0 === 0) return `M ${cx} ${cy} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} Z`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

const AREA_COLOURS = [C.foundation, C.navy, C.navy, C.navy, C.blue, C.blue, C.blue, C.teal, C.teal, C.teal];
const SAMPLE_SCORES = [0.55, 0.72, 0.46, 0.6, 0.82, 0.5, 0.66, 0.4, 0.76, 0.58];

/** The BOSS wheel with the weakest area lit up and labelled "Your constraint". */
function Wheel({ dark, hot }: { dark: boolean; hot: string }) {
  const r = WHEEL.size / 2;
  const R = r * 0.86;
  const step = (Math.PI * 2) / 10;
  const start = -Math.PI / 2 - step / 2;
  const inset = dark ? 0.012 : 0;
  const edge = dark ? {} : { stroke: C.ground, strokeWidth: 3 };
  const parts: ReactNode[] = [];
  for (let i = 0; i < 10; i++) {
    const a0 = start + i * step + inset;
    const a1 = a0 + step - 2 * inset;
    const fill = i === WHEEL.focus ? hot : dark ? "rgba(255,255,255,0.2)" : "#CBD5E1";
    parts.push(<path key={`b${i}`} d={wedge(r, r, 0, R, a0, a1)} fill={dark ? "#ffffff" : AREA_COLOURS[i]} opacity={dark ? 0.06 : 0.1} {...edge} />);
    parts.push(<path key={`s${i}`} d={wedge(r, r, 0, R * SAMPLE_SCORES[i], a0, a1)} fill={fill} {...edge} />);
  }
  const groups: [number, number, string][] = [
    [0, 1, C.foundation],
    [1, 4, C.navy],
    [4, 7, C.blue],
    [7, 10, C.teal],
  ];
  groups.forEach(([g0, g1, col]) =>
    parts.push(<path key={`g${g0}`} d={wedge(r, r, R * 1.05, R * 1.14, start + g0 * step + 0.02, start + g1 * step - 0.02)} fill={col} opacity={0.35} />)
  );
  const a = start + (WHEEL.focus + 0.5) * step;
  const tip = R * SAMPLE_SCORES[WHEEL.focus] + 26;
  const x = r + tip * Math.cos(a);
  const y = r + tip * Math.sin(a);
  return (
    <g transform={`translate(${WHEEL_X} ${WHEEL_Y})`}>
      {parts}
      <rect x={x - 168} y={y - 4} width={168} height={38} rx={19} fill={hot} />
      <text x={x - 84} y={y + 20} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={17} fill="#fff">
        Your constraint
      </text>
    </g>
  );
}

/** Three white step cards: number badge, icon, name, and a coloured bar with what happens. */
function Cards({ cards, uid }: { cards: Card[]; uid: string }) {
  return (
    <g transform={`translate(${CARDS_X} ${CARDS_Y})`}>
      <defs>
        <filter id={`${uid}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#0C5290" floodOpacity="0.2" />
        </filter>
        <clipPath id={`${uid}-card`}>
          <rect width={CARD.w} height={CARD.h} rx={14} />
        </clipPath>
      </defs>
      {cards.map((c, i) => {
        const iconSize = 44;
        return (
          <g key={c.label} transform={`translate(${i * (CARD.w + CARD.gap)} 0)`}>
            <rect width={CARD.w} height={CARD.h} rx={14} fill="#fff" filter={`url(#${uid}-shadow)`} />
            <g clipPath={`url(#${uid}-card)`}>
              <rect y={CARD.h - CARD.bar} width={CARD.w} height={CARD.bar} fill={c.colDark} />
            </g>
            <rect x={0.5} y={0.5} width={CARD.w - 1} height={CARD.h - 1} rx={13.5} fill="none" stroke="#E2E8F0" />
            <rect x={CARD.w - 40} y={10} width={30} height={30} rx={9} fill={c.col} />
            <text x={CARD.w - 25} y={31} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={16} fill="#fff">
              {i + 1}
            </text>
            <c.Icon x={(CARD.w - iconSize) / 2} y={22} width={iconSize} height={iconSize} color={c.col} strokeWidth={2} />
            <text x={CARD.w / 2} y={c.when ? 92 : 96} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={c.when ? 17 : 20} fill={c.col}>
              {c.label}
            </text>
            {c.when ? (
              <text x={CARD.w / 2} y={112} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={14} fill={C.slate}>
                {c.when}
              </text>
            ) : null}
            {c.tagline.map((line, j) => (
              <text key={j} x={CARD.w / 2} y={CARD.h - CARD.bar + 24 + j * 17} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={14} fill="#fff">
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

type Props = {
  option: BannerOption;
  /** Discreet coaches are never called a coach, so no Profit Coach logo. */
  discreet?: boolean;
  /** Lines can be clicked to edit them, and empty ones show a hint. */
  editable?: boolean;
  /** The line being edited is hidden; the editor draws it on top. */
  hiddenField?: BannerField | null;
  onFieldClick?: (field: BannerField) => void;
  /** Where each line ended up, for the editor's on-banner typing. */
  onLayout?: (boxes: Record<BannerField, FieldBox>) => void;
  className?: string;
};

/** One LinkedIn banner, 1584 x 396. The same SVG is shown, edited and downloaded. */
export const BannerSvg = forwardRef<SVGSVGElement, Props>(function BannerSvg(
  { option, discreet, editable, hiddenField, onFieldClick, onLayout, className },
  ref
) {
  const uid = `bn${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const design = bannerDesign(option.design);
  const w = option.words;
  const dark = design.dark;
  const textRefs = {
    eyebrow: useRef<SVGTextElement>(null),
    light: useRef<SVGTextElement>(null),
    bold: useRef<SVGTextElement>(null),
    boldPart: useRef<SVGTSpanElement>(null),
    cta: useRef<SVGTextElement>(null),
    note: useRef<SVGTextElement>(null),
  };
  const [widths, setWidths] = useState<Widths | null>(null);

  // Measure the words once the font is in, so the button fits and long lines shrink.
  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const len = (el: SVGTextContentElement | null) => (el && el.textContent ? el.getComputedTextLength() : 0);
      setWidths({
        eyebrow: len(textRefs.eyebrow.current),
        light: len(textRefs.light.current),
        bold: len(textRefs.bold.current),
        boldPart: len(textRefs.boldPart.current),
        cta: len(textRefs.cta.current),
        note: len(textRefs.note.current),
      });
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable; re-measure when the words change
  }, [w.eyebrow, w.light, w.bold, w.accent, w.cta, w.note, option.design]);

  const room = WORDS_END[design.picture] - COPY_X;
  const fit = (width: number) => (width > room ? room / width : 1);
  const estimate = (text: string, size: number) => text.length * size * 0.52;
  const ctaW = widths?.cta ?? estimate(w.cta, LINE.cta.size);
  const pillW = PILL.pad + ctaW + PILL.arrow + PILL.pad;
  const noteW = widths?.note ?? estimate(w.note, LINE.cta.size);
  const kEyebrow = fit(widths?.eyebrow ?? 0);
  const kHead = fit(Math.max(widths?.light ?? 0, widths?.bold ?? 0));
  const kRow = fit(pillW + (w.note ? 16 + noteW : 0));

  const ink = dark ? "#fff" : C.ink;
  const colours = {
    eyebrow: dark ? "#8FD0FF" : C.navy,
    light: dark ? "rgba(255,255,255,.78)" : C.slate,
    bold: ink,
    accent: dark ? "#7CD3F7" : C.sky,
    cta: dark ? C.navy : "#fff",
    note: dark ? "rgba(255,255,255,.7)" : C.slate,
  };

  const boxes: Record<BannerField, FieldBox> = {
    eyebrow: { x: COPY_X, y: LINE.eyebrow.y, size: LINE.eyebrow.size, weight: LINE.eyebrow.weight, color: colours.eyebrow, scale: kEyebrow },
    light: { x: COPY_X, y: LINE.light.y, size: LINE.light.size, weight: LINE.light.weight, color: colours.light, scale: kHead },
    bold: { x: COPY_X, y: LINE.bold.y, size: LINE.bold.size, weight: LINE.bold.weight, color: colours.bold, scale: kHead },
    accent: {
      x: COPY_X + (widths?.boldPart ?? 0) * kHead,
      y: LINE.bold.y,
      size: LINE.bold.size,
      weight: LINE.bold.weight,
      color: colours.accent,
      scale: kHead,
    },
    cta: { x: COPY_X + PILL.pad * kRow, y: LINE.cta.y, size: LINE.cta.size, weight: LINE.cta.weight, color: colours.cta, scale: kRow },
    note: { x: COPY_X + (pillW + 16) * kRow, y: LINE.cta.y, size: LINE.cta.size, weight: 500, color: colours.note, scale: kRow },
  };

  const layoutKey = JSON.stringify(boxes);
  const lastLayout = useRef("");
  useLayoutEffect(() => {
    if (!onLayout || lastLayout.current === layoutKey) return;
    lastLayout.current = layoutKey;
    onLayout(boxes);
  });

  const click = (field: BannerField) =>
    editable && onFieldClick
      ? {
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onFieldClick(field);
          },
          style: { cursor: "text" },
        }
      : {};
  const hide = (field: BannerField) => (hiddenField === field ? { opacity: 0 } : {});
  /** In the editor an empty line shows faintly, so it can be clicked and filled. */
  const shown = (field: BannerField, hint: string) => (w[field] ? w[field] : editable ? hint : "");
  const faint = (field: BannerField) => (!w[field] && editable ? { fillOpacity: 0.35 } : {});

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${BANNER_W} ${BANNER_H}`}
      width={BANNER_W}
      height={BANNER_H}
      className={className}
      role="img"
      aria-label={[w.light, w.bold + w.accent].filter(Boolean).join(" ")}
    >
      <defs>
        <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor={C.deep} />
          <stop offset="0.55" stopColor={C.navy} />
          <stop offset="1" stopColor={C.sky} />
        </linearGradient>
      </defs>
      <rect width={BANNER_W} height={BANNER_H} fill={dark ? `url(#${uid}-ground)` : C.ground} />

      {design.picture === "wheel" ? (
        <Wheel dark={dark} hot={HOT[design.hot ?? "red"]} />
      ) : (
        <Cards cards={design.picture === "offer" ? OFFER : SCORE} uid={uid} />
      )}

      {discreet ? null : <g dangerouslySetInnerHTML={{ __html: logo(52, 40, 190, `${uid}l`, dark ? "white" : "colour") }} />}

      <g fontFamily={FONT}>
        <text
          ref={textRefs.eyebrow}
          x={COPY_X}
          y={LINE.eyebrow.y}
          fontSize={LINE.eyebrow.size}
          fontWeight={LINE.eyebrow.weight}
          fill={colours.eyebrow}
          transform={scaleAt(COPY_X, LINE.eyebrow.y, kEyebrow)}
          {...faint("eyebrow")}
          {...hide("eyebrow")}
          {...click("eyebrow")}
        >
          {shown("eyebrow", "Who it's for")}
        </text>
        <text
          ref={textRefs.light}
          x={COPY_X}
          y={LINE.light.y}
          fontSize={LINE.light.size}
          fontWeight={LINE.light.weight}
          letterSpacing={-0.8}
          fill={colours.light}
          transform={scaleAt(COPY_X, LINE.light.y, kHead)}
          {...faint("light")}
          {...hide("light")}
          {...click("light")}
        >
          {shown("light", "First line")}
        </text>
        <text
          ref={textRefs.bold}
          x={COPY_X}
          y={LINE.bold.y}
          fontSize={LINE.bold.size}
          fontWeight={LINE.bold.weight}
          letterSpacing={-1.1}
          transform={scaleAt(COPY_X, LINE.bold.y, kHead)}
          xmlSpace="preserve"
        >
          <tspan ref={textRefs.boldPart} fill={colours.bold} {...hide("bold")} {...click("bold")}>
            {w.bold}
          </tspan>
          <tspan fill={colours.accent} {...faint("accent")} {...hide("accent")} {...click("accent")}>
            {shown("accent", "Words in colour")}
          </tspan>
        </text>
        <g transform={scaleAt(COPY_X, LINE.cta.y, kRow)}>
          <rect x={COPY_X} y={PILL.y} width={pillW} height={PILL.h} rx={PILL.h / 2} fill={dark ? "#fff" : C.navy} />
          <text
            ref={textRefs.cta}
            x={COPY_X + PILL.pad}
            y={LINE.cta.y}
            fontSize={LINE.cta.size}
            fontWeight={LINE.cta.weight}
            fill={colours.cta}
            {...hide("cta")}
            {...click("cta")}
          >
            {w.cta}
          </text>
          <text x={COPY_X + PILL.pad + ctaW + 10} y={LINE.cta.y} fontSize={LINE.cta.size} fontWeight={400} fill={colours.cta}>
            →
          </text>
          <text
            ref={textRefs.note}
            x={COPY_X + pillW + 16}
            y={LINE.cta.y}
            fontSize={LINE.cta.size}
            fontWeight={500}
            fill={colours.note}
            {...faint("note")}
            {...hide("note")}
            {...click("note")}
          >
            {shown("note", "Add a short line")}
          </text>
        </g>
      </g>
    </svg>
  );
});
