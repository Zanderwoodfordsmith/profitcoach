"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Outfit } from "next/font/google";
import { ASSESSMENT_QUESTIONS } from "@/lib/assessmentQuestions";
import { LEVELS, PLAYBOOKS } from "@/lib/bossData";
import {
  computePillarScores,
  type AnswersMap,
  type PillarScores,
} from "@/lib/bossScores";
import { SpeedDials } from "./SpeedDials";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const TOOLTIP_DELAY_MS = 800;

export type BossGridBorderedProps = {
  answers: AnswersMap;
  showDials?: boolean;
  showHeaders?: boolean;
  interactive?: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  /** When set, cells link to playbook detail (e.g. /client/playbooks or /coach/contacts/123/playbooks) */
  playbookLinkBase?: string;
};

const AREA_NAMES = [
  "Owner Performance",
  "Aligned Vision",
  "Defined Strategy",
  "Disciplined Planning",
  "Profit & Cash Flow",
  "Revenue & Marketing",
  "Operations & Delivery",
  "Financials & Metrics",
  "Infrastructure & Systems",
  "Team & Leadership",
];

const PILLAR_AREA_INDICES = [[0], [1, 2, 3], [4, 5, 6], [7, 8, 9]] as const;

// Spec: pillar colors and header background tints
const PILLAR_SPEC = [
  { name: "Foundation", main: "#9333EA", bg: "#FAF5FF" },
  { name: "Clarify Vision", main: "#2563EB", bg: "#EFF6FF" },
  { name: "Control Velocity", main: "#0284C7", bg: "#F0F9FF" },
  { name: "Create Value", main: "#0D9488", bg: "#F0FDFA" },
] as const;

// Spec: area colors (index = area ref)
const AREA_COLORS = ["#9333EA", "#1E3A8A", "#2563EB", "#3B82F6", "#075985", "#0284C7", "#38BDF8", "#115E59", "#0D9488", "#2DD4BF"] as const;

// Cell styles per status (with hover)
const CELL_STYLES = {
  green: {
    bg: "#ECFDF5",
    bgHover: "#D1FAE5",
    border: "#A7F3D0",
    bar: "#22C55E",
    barHeight: 3.5,
    text: "#1E293B",
    textWeight: 520,
    shadow: "0 1px 4px rgba(34,197,94,0.12)",
    tickBg: "#DCFCE7",
    tickBorder: "#86EFAC",
    tickColor: "#16A34A",
  },
  amber: {
    bg: "#FFFBF0",
    bgHover: "#FEF3C7",
    border: "#FDE68A",
    bar: "#F59E0B",
    barHeight: 3,
    text: "#64748B",
    textWeight: 460,
    shadow: "0 1px 3px rgba(245,158,11,0.06)",
  },
  red: {
    bg: "#FAFBFC",
    bgHover: "#F1F5F9",
    border: "#EEF1F5",
    borderHover: "#E8ECF1",
    bar: "rgba(226,232,240,0.5)",
    barHeight: 2,
    text: "#94A3B8",
    textWeight: 400,
    shadow: "none",
    shadowHover: "0 1px 3px rgba(0,0,0,0.04)",
  },
  unscored: {
    bg: "#FAFBFC",
    bgHover: "#F1F5F9",
    border: "#F1F5F9",
    text: "#CBD5E1",
    textWeight: 380,
    shadow: "none",
  },
} as const;

function getScoreStyle(score: 0 | 1 | 2 | undefined, isHovered: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 5,
    height: 50,
    padding: "0 10px",
    fontSize: 11,
    transition: "all 0.2s ease",
  };
  if (score === 2) {
    const s = CELL_STYLES.green;
    return {
      ...base,
      background: isHovered ? s.bgHover : s.bg,
      border: `1px solid ${s.border}`,
      borderBottom: `${s.barHeight}px solid ${s.bar}`,
      boxShadow: s.shadow,
    };
  }
  if (score === 1) {
    const s = CELL_STYLES.amber;
    return {
      ...base,
      background: isHovered ? s.bgHover : s.bg,
      border: `1px solid ${s.border}`,
      borderBottom: `${s.barHeight}px solid ${s.bar}`,
      boxShadow: s.shadow,
    };
  }
  if (score === 0) {
    const s = CELL_STYLES.red;
    return {
      ...base,
      background: isHovered ? s.bgHover : s.bg,
      border: `1px solid ${isHovered ? s.borderHover : s.border}`,
      borderBottom: `${s.barHeight}px solid ${s.bar}`,
      boxShadow: isHovered ? s.shadowHover : s.shadow,
    };
  }
  const s = CELL_STYLES.unscored;
  return {
    ...base,
    background: isHovered ? s.bgHover : s.bg,
    border: "1px dashed #F1F5F9",
    boxShadow: s.shadow,
  };
}

function getScoreTextStyle(score: 0 | 1 | 2 | undefined): React.CSSProperties {
  if (score === 2) return { color: CELL_STYLES.green.text, fontWeight: CELL_STYLES.green.textWeight };
  if (score === 1) return { color: CELL_STYLES.amber.text, fontWeight: CELL_STYLES.amber.textWeight };
  if (score === 0) return { color: CELL_STYLES.red.text, fontWeight: CELL_STYLES.red.textWeight };
  return { color: CELL_STYLES.unscored.text, fontWeight: CELL_STYLES.unscored.textWeight };
}

export function BossGridBordered({
  answers,
  showDials = true,
  showHeaders = true,
  interactive = false,
  onScoreChange,
  playbookLinkBase,
}: BossGridBorderedProps) {
  const router = useRouter();
  const pillarScores = computePillarScores(answers);
  const [tooltip, setTooltip] = useState<{ ref: string; rect: { left: number; top: number; bottom: number } } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  const handleCellHover = useCallback((ref: string | null, element: HTMLElement | null) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    if (!ref || !element) {
      setTooltip(null);
      setTooltipVisible(false);
      return;
    }
    const rect = element.getBoundingClientRect();
    setTooltip({ ref, rect: { left: rect.left, top: rect.top, bottom: rect.bottom } });
    setTooltipVisible(false);
    tooltipTimeoutRef.current = setTimeout(() => {
      tooltipTimeoutRef.current = null;
      setTooltipVisible(true);
    }, TOOLTIP_DELAY_MS);
  }, []);

  const LEVEL_COL_WIDTH = 92;
  const gridCols = `${LEVEL_COL_WIDTH}px 0.5fr 3.5fr 3.5fr 3.5fr`;

  const question = tooltip && tooltipVisible
    ? ASSESSMENT_QUESTIONS.find((q) => q.ref === tooltip.ref)
    : null;

  return (
    <div className={`flex flex-col w-full min-w-[1100px] ${outfit.variable}`} style={{ fontFamily: "var(--font-outfit), sans-serif", background: "#FAFBFC" }}>
      {showDials && <SpeedDials pillarScores={pillarScores} gridCols={gridCols} />}
      <div
        className="grid w-full min-w-[1100px] gap-x-3 gap-y-0"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: "44px 34px repeat(5, 58px)",
        }}
        role="grid"
        aria-label="BOSS playbook grid (bordered)"
      >
        {showHeaders && (
          <>
            <div className="flex flex-col justify-center items-center p-2 min-w-0 bg-transparent" />
            {PILLAR_SPEC.map((pillar, pillarIdx) => {
              const pct = pillarIdx === 0 ? 0 : pillarIdx === 1 ? Math.round((pillarScores.vision / 30) * 100) : pillarIdx === 2 ? Math.round((pillarScores.velocity / 30) * 100) : Math.round((pillarScores.value / 30) * 100);
              return (
                <div
                  key={pillar.name}
                  className="flex flex-col justify-center items-stretch rounded-t-lg border border-b-0 border-[#F1F5F9] px-3"
                  style={{
                    height: 44,
                    background: pillar.bg,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.015)",
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 3, height: 18, borderRadius: 2, background: pillar.main }} />
                      <span style={{ fontSize: 13.5, fontWeight: 660, color: pillar.main, letterSpacing: -0.2 }}>
                        {pillar.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pillar.main, opacity: 0.45 }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {showHeaders && <div className="bg-transparent" style={{ gridColumn: 1, gridRow: 2 }} />}
        {LEVELS.map((level, idx) => (
          <div
            key={level.id}
            className="flex flex-col justify-center items-end pr-2 text-right bg-transparent"
            style={{ gridColumn: 1, gridRow: idx + 3, height: 58 }}
            aria-label={`Level ${level.id}, ${level.name}`}
          >
            <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#CBD5E1", lineHeight: 1 }}>
              Level
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span style={{ fontSize: 18, fontWeight: 750, color: "#E2E8F0", letterSpacing: -0.5, lineHeight: 1 }}>
                {level.id}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 420, color: "#94A3B8", lineHeight: 1 }}>
                {level.name}
              </span>
            </div>
          </div>
        ))}
        {PILLAR_AREA_INDICES.map((areaIndices, pillarIdx) => (
          <div
            key={pillarIdx}
            className="rounded-b-lg border border-t-0 border-[#F1F5F9] overflow-hidden"
            style={{
              gridColumn: pillarIdx + 2,
              gridRow: "2 / 8",
              background: "#FFFFFF",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.015)",
            }}
          >
            <PillarCardBordered
              areaIndices={areaIndices}
              answers={answers}
              interactive={interactive}
              onScoreChange={onScoreChange}
              playbookLinkBase={playbookLinkBase}
              onPlaybookClick={
                playbookLinkBase
                  ? (ref: string) => router.push(`${playbookLinkBase}/${ref}`)
                  : undefined
              }
              getScoreStyle={getScoreStyle}
              getScoreTextStyle={getScoreTextStyle}
              onCellHover={handleCellHover}
            />
          </div>
        ))}
      </div>
      {typeof document !== "undefined" &&
        question &&
        tooltip &&
        tooltipVisible &&
        createPortal(
          <div
            className="fixed z-50 max-w-sm rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
            style={{
              left: Math.min(tooltip.rect.left, typeof window !== "undefined" ? window.innerWidth - 336 : tooltip.rect.left),
              top: tooltip.rect.bottom + 6,
            }}
            role="tooltip"
          >
            <p className="mb-2 text-sm font-medium text-slate-900">{question.question}</p>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>
                <span className="font-semibold text-red-600">Not in place:</span>{" "}
                {question.scoringGuide.red}
              </li>
              <li>
                <span className="font-semibold text-amber-600">Partially:</span>{" "}
                {question.scoringGuide.amber}
              </li>
              <li>
                <span className="font-semibold text-emerald-600">Fully in place:</span>{" "}
                {question.scoringGuide.green}
              </li>
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

function PillarCardBordered({
  areaIndices,
  answers,
  interactive,
  onScoreChange,
  playbookLinkBase,
  onPlaybookClick,
  getScoreStyle,
  getScoreTextStyle,
  onCellHover,
}: {
  areaIndices: readonly number[];
  answers: AnswersMap;
  interactive: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  playbookLinkBase?: string;
  onPlaybookClick?: (ref: string) => void;
  getScoreStyle: (s: 0 | 1 | 2 | undefined, isHovered: boolean) => React.CSSProperties;
  getScoreTextStyle: (s: 0 | 1 | 2 | undefined) => React.CSSProperties;
  onCellHover?: (ref: string | null, element: HTMLElement | null) => void;
}) {
  const [hoveredRef, setHoveredRef] = useState<string | null>(null);
  const nCols = areaIndices.length;
  return (
    <div
      className="grid h-full w-full"
      style={{
        gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))`,
        gridTemplateRows: "34px repeat(5, 50px)",
        gap: 8,
      }}
    >
      {areaIndices.map((areaIdx) => (
        <div
          key={areaIdx}
          className="flex flex-col justify-center items-center text-center border-b border-[#F8FAFC] px-1"
          style={{
            height: 34,
            fontSize: 10.5,
            fontWeight: 500,
            color: AREA_COLORS[areaIdx],
            opacity: 0.6,
          }}
        >
          {AREA_NAMES[areaIdx]}
        </div>
      ))}
      {LEVELS.map((level) =>
        areaIndices.map((areaIdx) => {
          const playbook = PLAYBOOKS.find((p) => p.level === level.id && p.area === areaIdx);
          if (!playbook) return null;
          const score = answers[playbook.ref] as 0 | 1 | 2 | undefined;
          const isHovered = hoveredRef === playbook.ref;
          const handleClick = () => {
            if (interactive && onScoreChange) {
              const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
              onScoreChange(playbook.ref, next);
            } else if (onPlaybookClick) {
              onPlaybookClick(playbook.ref);
            }
          };
          const handleContextMenu = onPlaybookClick
            ? (e: React.MouseEvent) => {
                e.preventDefault();
                onPlaybookClick(playbook.ref);
              }
            : undefined;
          const isClickable = (interactive && onScoreChange) || onPlaybookClick;
          const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
            setHoveredRef(playbook.ref);
            onCellHover?.(playbook.ref, e.currentTarget);
          };
          const handleMouseLeave = () => {
            setHoveredRef(null);
            onCellHover?.(null, null);
          };
          return (
            <div
              key={playbook.ref}
              style={getScoreStyle(score, isHovered)}
              className={`relative flex flex-row items-center min-w-0 text-left leading-tight capitalize ${
                isClickable ? "cursor-pointer" : ""
              }`}
              role={interactive && onScoreChange ? "button" : isClickable ? "button" : "gridcell"}
              tabIndex={isClickable ? 0 : undefined}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onKeyDown={
                interactive && onScoreChange
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                        onScoreChange(playbook.ref, next);
                      }
                    }
                  : onPlaybookClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPlaybookClick(playbook.ref);
                        }
                      }
                    : undefined
              }
              aria-label={
                interactive && onScoreChange
                  ? `${playbook.name}: ${score === 0 ? "Not in place" : score === 1 ? "Partially in place" : score === 2 ? "Fully in place" : "Not scored"}. Click to cycle. Right-click to open playbook.`
                  : onPlaybookClick
                    ? `${playbook.name}. Click to open playbook.`
                    : undefined
              }
            >
              <span className="block min-w-0 flex-1 pr-5 line-clamp-2" style={{ ...getScoreTextStyle(score), lineHeight: 1.2, letterSpacing: -0.1 }}>
                {playbook.name.replace(/ & /g, " &\n")}
              </span>
              {score === 2 && (
                <span
                  className="absolute -top-1 right-0 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-bold"
                  style={{
                    background: CELL_STYLES.green.tickBg,
                    borderColor: CELL_STYLES.green.tickBorder,
                    color: CELL_STYLES.green.tickColor,
                  }}
                  aria-hidden
                >
                  ✓
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
