"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Layers } from "lucide-react";
import { Outfit } from "next/font/google";
import { AREAS, BOSS_FOUNDATION_COLOR, getLevelColor, getLevelIcon, LEVELS, PLAYBOOKS } from "@/lib/bossData";
import { getTotalScore, type AnswersMap } from "@/lib/bossScores";
import { BossGridMobileStacked } from "./BossGridMobileStacked";
import { BossGridInfoIcon, type BossGridInfoPanelHeader } from "./BossGridInfoIcon";
import { BossQuestionTooltipPortal, useBossQuestionTooltip, BOSS_QUESTION_TOOLTIP_DELAY_MS } from "./bossQuestionTooltip";
import {
  getBossAreaInfoSections,
  getBossLevelInfoSections,
  getBossPillarInfoSections,
} from "@/lib/bossGridInfo";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export type BossGridTransposedProps = {
  answers: AnswersMap;
  interactive?: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  playbookLinkBase?: string;
  /** When true, uses glass design: simple cells (color + dots), flip on hover to show playbook name */
  glass?: boolean;
  /** When glass: 'dark' = dark chrome (default), 'light' = light background and headers; cells/statuses unchanged */
  glassTheme?: "dark" | "light";
  /** When set (and glass), show playbook names for these scores; other cells show dot + flip on hover */
  showNamesForScores?: readonly (0 | 1 | 2)[];
  /** When glass + dark theme: header row and table wrapper use this color (header 0.9 alpha, table 0.4 alpha) */
  chromeColor?: string;
  /** When set (and glass), renders a header row with this title (large, left) and score bar (right); table is centered below */
  title?: string;
  /** When "neutral", score bar shows short labels next to maturity counts (no "red/green" wording) */
  scoreBarLabels?: "none" | "neutral";
  /** Glass: show full playbook name in every cell (wrapped) instead of dot + flip card */
  glassAlwaysShowPlaybookNames?: boolean;
  /** Glass: per-playbook session notes shown in the scoring panel */
  playbookNotes?: Record<string, string>;
  onPlaybookNotesChange?: (ref: string, notes: string) => void;
  /** Glass: hide built-in score bar (counts + /100) — use an external summary row instead */
  hideGlassScoreBar?: boolean;
  /** Glass: label for the top-left header cell (replaces the grid icon). */
  gridCornerLabel?: string;
};

// Match Profit System Glass pillar colors
const PILLARS: { key: "foundation" | "vision" | "velocity" | "value"; name: string; color: string }[] = [
  { key: "foundation", name: "Foundation", color: BOSS_FOUNDATION_COLOR },
  { key: "vision", name: "Clarify Vision", color: "#3B82F6" },
  { key: "velocity", name: "Control Velocity", color: "#0EA5E9" },
  { key: "value", name: "Create Value", color: "#14B8A6" },
];

// Default (non-glass) cell styling
const CELL_STYLES = {
  green: { bg: "#ECFDF5", border: "#A7F3D0", bar: "#22C55E", barHeight: 3.5, text: "#1E293B", textWeight: 520 },
  amber: { bg: "#FFFBF0", border: "#FDE68A", bar: "#F59E0B", barHeight: 3, text: "#64748B", textWeight: 460 },
  red: { bg: "#FAFBFC", border: "#EEF1F5", bar: "rgba(226,232,240,0.5)", barHeight: 2, text: "#94A3B8", textWeight: 400 },
  unscored: { bg: "#FAFBFC", border: "#F1F5F9", text: "#CBD5E1", textWeight: 380 },
} as const;

// Glass variant: cells ~60–70% opaque; yellow bright, red/green slightly brighter
const GLASS_CELL = {
  red: {
    bg: "rgba(200, 75, 95, 0.62)",
    dot: "#E85A6B",
    glow: "0 0 6px rgba(232, 90, 107, 0.5), 0 0 14px rgba(200, 75, 95, 0.4)",
    borderGlow: "rgba(200, 75, 95, 0.55)",
  },
  amber: {
    bg: "rgba(250, 220, 60, 0.65)",
    dot: "#FDE047",
    glow: "0 0 6px rgba(253, 224, 71, 0.6), 0 0 14px rgba(250, 220, 60, 0.45)",
    borderGlow: "rgba(253, 224, 71, 0.5)",
  },
  green: {
    bg: "rgba(52, 211, 120, 0.6)",
    dot: "#4ADE80",
    glow: "0 0 6px rgba(74, 222, 128, 0.6), 0 0 14px rgba(52, 211, 120, 0.4)",
    borderGlow: "rgba(52, 211, 120, 0.55)",
  },
  unscored: {
    bg: "rgba(148, 163, 184, 0.35)",
    dot: "#94a3b8",
    glow: "0 0 4px rgba(148, 163, 184, 0.4)",
    borderGlow: "rgba(255, 255, 255, 0.25)",
  },
} as const;

// Back face of flip card: solid colours so it always shows when rotated
const FLIP_BACK_BG: Record<keyof typeof GLASS_CELL, string> = {
  red: "#6b3842",
  amber: "#6b6020",
  green: "#2d6b4a",
  unscored: "rgba(148, 163, 184, 0.5)",
};

const GLASS_AREA_ROW_BORDER = "none";
const GLASS_PILLAR_TOP_GAP = 24;
const GLASS_PILLAR_FIRST_TOP_GAP = 8;
const GLASS_AREA_PAD_TOP = 8;
const GLASS_AREA_PAD_TOP_FIRST = 6;
const GLASS_AREA_PAD_BOTTOM = 3;
const GLASS_AREA_PAD_BOTTOM_LAST = 10;
const GLASS_AREA_PAD_LEFT = 28;

function getCellStyle(score: 0 | 1 | 2 | undefined): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 5,
    minHeight: 44,
    padding: "10px 12px",
    fontSize: 16,
    lineHeight: 1.25,
    border: "1px solid",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
  };
  if (score === 2) {
    const s = CELL_STYLES.green;
    return { ...base, background: s.bg, borderColor: s.border, borderBottom: `${s.barHeight}px solid ${s.bar}`, color: s.text, fontWeight: s.textWeight };
  }
  if (score === 1) {
    const s = CELL_STYLES.amber;
    return { ...base, background: s.bg, borderColor: s.border, borderBottom: `${s.barHeight}px solid ${s.bar}`, color: s.text, fontWeight: s.textWeight };
  }
  if (score === 0) {
    const s = CELL_STYLES.red;
    return { ...base, background: s.bg, borderColor: s.border, borderBottom: `${s.barHeight}px solid ${s.bar}`, color: s.text, fontWeight: s.textWeight };
  }
  const s = CELL_STYLES.unscored;
  return { ...base, background: s.bg, border: "1px dashed #F1F5F9", color: s.text, fontWeight: s.textWeight };
}

function getGlassCellStyle(score: 0 | 1 | 2 | undefined): React.CSSProperties {
  const g = score === 0 ? GLASS_CELL.red : score === 1 ? GLASS_CELL.amber : score === 2 ? GLASS_CELL.green : GLASS_CELL.unscored;
  return {
    background: g.bg,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: `1px solid ${g.borderGlow}`,
    borderRadius: 6,
    minHeight: 44,
    position: "relative",
  };
}

/** Hex to rgba with alpha (e.g. "#0f172a" -> "rgba(15, 23, 42, 0.9)"). */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.slice(1).match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Rough luminance (0–1); use to pick light vs dark text on background. */
function luminance(hex: string): number {
  const m = hex.slice(1).match(/.{2}/g);
  if (!m) return 0.5;
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Levels in order: L1 Overwhelm, L2 Overworked, L3 Organised, L4 Overseer, L5 Owner
const LEVEL_COLUMNS = [...LEVELS].reverse();

const LIGHT_GLASS_CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";
const COL_WIDTH = 152;
const CATEGORIES_COL_WIDTH = 212; // First column: pillar / area labels
const COL_WIDTH_COLLAPSED = 44; // Collapsed level column

function getLevelInfoHeader(levelId: number, levelName: string): BossGridInfoPanelHeader | undefined {
  const iconSrc = getLevelIcon(levelId);
  const accentColor = getLevelColor(levelId);
  if (!iconSrc || !accentColor) return undefined;
  return {
    iconSrc,
    accentColor,
    eyebrow: `Level ${levelId}`,
    title: levelName,
  };
}

export function BossGridTransposed({
  answers,
  interactive = false,
  onScoreChange,
  playbookLinkBase,
  glass = false,
  glassTheme = "dark",
  showNamesForScores = [],
  chromeColor,
  title,
  scoreBarLabels = "none",
  glassAlwaysShowPlaybookNames = false,
  playbookNotes,
  onPlaybookNotesChange,
  hideGlassScoreBar = false,
  gridCornerLabel,
}: BossGridTransposedProps) {
  const router = useRouter();
  const tooltipDelay =
    glass && interactive ? 320 : BOSS_QUESTION_TOOLTIP_DELAY_MS;
  const workshopSheetMode = Boolean(glass && onScoreChange);
  const {
    tooltip,
    tooltipVisible,
    handleCellHover,
    openTooltipPinned,
    openWorkshopSheet,
    dismissTooltip,
    cancelHide,
    scheduleHide,
    tooltipAnchorRef,
  } = useBossQuestionTooltip(tooltipDelay, { workshopSheetMode });
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(new Set());
  const isLightGlass = glass && glassTheme === "light";
  const useLightGlassSlateHeader = isLightGlass;
  const lightGlassSlateHeaderBg = "#334155";
  const lightGlassSlateHeaderBorder = "rgba(71, 85, 105, 0.4)";
  const useChromeColor = Boolean(glass && !isLightGlass && chromeColor);
  const chromeHex = useChromeColor && chromeColor ? chromeColor : null;
  const headerBg = chromeHex ? hexToRgba(chromeHex, 0.9) : undefined;
  const tableBg = chromeHex ? hexToRgba(chromeHex, 0.4) : undefined;
  const chromeTextColor = chromeHex
    ? (luminance(chromeHex) < 0.4 ? "#e2e8f0" : "#1e293b")
    : undefined;

  const toggleLevel = (levelId: number) => {
    setCollapsedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  };

  const handleTooltipPickScore = useCallback(
    (ref: string, score: 0 | 1 | 2) => {
      onScoreChange?.(ref, score);
    },
    [onScoreChange]
  );

  const tooltipPortalProps = {
    onPickScore: glass && onScoreChange ? handleTooltipPickScore : undefined,
    onPortalMouseEnter: glass ? cancelHide : undefined,
    onPortalMouseLeave: glass ? scheduleHide : undefined,
    answerScores: glass ? answers : undefined,
    getPlaybookUrl:
      glass && playbookLinkBase
        ? (ref: string) => `${playbookLinkBase}/${ref}`
        : undefined,
    playbookNotes: glass ? playbookNotes : undefined,
    onPlaybookNotesChange: glass ? onPlaybookNotesChange : undefined,
    onDismiss: glass ? dismissTooltip : undefined,
    anchorRef: glass ? tooltipAnchorRef : undefined,
  };

  const glassQuestionHoverProps = useCallback(
    (playbookRef: string) =>
      glass
        ? {
            onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
              handleCellHover(playbookRef, e.currentTarget),
            onMouseLeave: () => handleCellHover(null, null),
            onFocus: (e: React.FocusEvent<HTMLElement>) =>
              handleCellHover(playbookRef, e.currentTarget),
            onBlur: () => handleCellHover(null, null),
          }
        : {},
    [glass, handleCellHover]
  );

  const tryOpenBossScorePanel = useCallback(
    (ref: string, el: HTMLElement | null) => {
      if (!glass || !onScoreChange || !el) return false;
      openTooltipPinned(ref, el);
      return true;
    },
    [glass, onScoreChange, openTooltipPinned]
  );

  const mobileStackedView = (
    <BossGridMobileStacked
      answers={answers}
      interactive={interactive}
      onScoreChange={onScoreChange}
      playbookLinkBase={playbookLinkBase}
      playbookNotes={playbookNotes}
      onPlaybookNotesChange={onPlaybookNotesChange}
      onOpenPlaybook={workshopSheetMode ? openWorkshopSheet : undefined}
    />
  );

  const totalScore = glass ? getTotalScore(answers) : 0;
  const scoreCounts = glass
    ? {
        green: PLAYBOOKS.filter((p) => answers[p.ref] === 2).length,
        amber: PLAYBOOKS.filter((p) => answers[p.ref] === 1).length,
        red: PLAYBOOKS.filter((p) => answers[p.ref] === 0).length,
      }
    : { green: 0, amber: 0, red: 0 };

  const tableContent = (
    <table
      role="grid"
      aria-label={glass ? "BOSS playbook grid (transposed, glass)" : "BOSS playbook grid (transposed)"}
      className="w-full min-w-[600px] border-collapse"
      style={{ fontSize: glass ? 15 : 16, tableLayout: "fixed" }}
    >
      <colgroup>
        <col style={{ width: CATEGORIES_COL_WIDTH }} />
        {LEVEL_COLUMNS.map((level) => {
          const isCollapsed = glass && collapsedLevels.has(level.id);
          return (
            <col
              key={level.id}
              style={isCollapsed ? { width: COL_WIDTH_COLLAPSED } : undefined}
            />
          );
        })}
      </colgroup>
      <thead>
        <tr>
          <th
            className="align-bottom text-left font-semibold"
            style={{
              padding: glass ? "8px 20px 12px" : "10px 12px",
              width: CATEGORIES_COL_WIDTH,
              minWidth: CATEGORIES_COL_WIDTH,
              verticalAlign: glass && gridCornerLabel ? "bottom" : undefined,
              borderBottom: glass
                ? useLightGlassSlateHeader
                  ? `1px solid ${lightGlassSlateHeaderBorder}`
                  : isLightGlass
                    ? "1px solid rgba(0,0,0,0.06)"
                    : "1px solid rgba(255,255,255,0.08)"
                : "2px solid #E2E8F0",
              borderRight: glass ? "none" : undefined,
              ...(useLightGlassSlateHeader ? { borderTopLeftRadius: 12 } : {}),
              background: glass
                ? useLightGlassSlateHeader
                  ? lightGlassSlateHeaderBg
                  : "transparent"
                : "#F8FAFC",
              color:
                glass
                  ? (chromeTextColor ??
                    (useLightGlassSlateHeader
                      ? "#ffffff"
                      : isLightGlass
                        ? "#0f172a"
                        : "#e2e8f0"))
                  : undefined,
            }}
          >
            {glass && gridCornerLabel ? (
              <span
                className="block text-left"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: useLightGlassSlateHeader
                    ? "rgba(255,255,255,0.95)"
                    : isLightGlass
                      ? "rgba(15,23,42,0.45)"
                      : "rgba(255,255,255,0.35)",
                }}
              >
                {gridCornerLabel}
              </span>
            ) : glass ? (
              <div className="flex items-center justify-center" aria-hidden>
                <LayoutGrid
                  className={`h-5 w-5 ${
                    useLightGlassSlateHeader
                      ? "text-white/35"
                      : isLightGlass
                        ? "text-slate-400/25"
                        : "text-white/20"
                  }`}
                  strokeWidth={1.25}
                />
              </div>
            ) : (
              " "
            )}
          </th>
          {LEVEL_COLUMNS.map((level, levelIdx) => {
            const isCollapsed = glass && collapsedLevels.has(level.id);
            const w = isCollapsed ? COL_WIDTH_COLLAPSED : COL_WIDTH;
            return (
              <th
                key={level.id}
                role={glass ? "button" : undefined}
                tabIndex={glass ? 0 : undefined}
                onClick={glass ? () => toggleLevel(level.id) : undefined}
                onKeyDown={
                  glass
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleLevel(level.id);
                        }
                      }
                    : undefined
                }
                className={isCollapsed ? "text-center font-medium" : "text-left font-medium"}
                style={{
                  padding: isCollapsed ? "8px 10px 10px" : "8px 14px 12px",
                  width: w,
                  minWidth: w,
                  borderBottom: glass
                    ? useLightGlassSlateHeader
                      ? `1px solid ${lightGlassSlateHeaderBorder}`
                      : isLightGlass
                        ? "1px solid rgba(0,0,0,0.06)"
                        : "1px solid rgba(255,255,255,0.08)"
                    : "2px solid #E2E8F0",
                  background: glass
                    ? useLightGlassSlateHeader
                      ? lightGlassSlateHeaderBg
                      : "transparent"
                    : "#F8FAFC",
                  color:
                    glass
                      ? (chromeTextColor ??
                        (useLightGlassSlateHeader
                          ? "#ffffff"
                          : isLightGlass
                            ? "#334155"
                            : "rgba(255,255,255,0.85)"))
                      : undefined,
                  fontSize: glass ? 14 : undefined,
                  cursor: glass ? "pointer" : undefined,
                  ...(useLightGlassSlateHeader && levelIdx === LEVEL_COLUMNS.length - 1
                    ? { borderTopRightRadius: 12 }
                    : {}),
                }}
                aria-label={glass ? (isCollapsed ? `Expand level ${level.id} (${level.name})` : `Collapse level ${level.id}`) : undefined}
              >
                {glass ? (
                  <div
                    className={`flex w-full flex-col items-center gap-0.5 ${isCollapsed ? "justify-center" : ""}`}
                  >
                    <Layers
                      className={`shrink-0 ${isCollapsed ? "h-3 w-3" : "h-3 w-3"} ${
                        useLightGlassSlateHeader
                          ? "text-white/35"
                          : isLightGlass
                            ? "text-slate-400/30"
                            : "text-white/25"
                      }`}
                      strokeWidth={1.25}
                      aria-hidden
                    />
                    <span
                      className={isCollapsed ? "text-xs" : "min-w-0 truncate text-center"}
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: 1.2,
                        color: useLightGlassSlateHeader
                          ? "rgba(255,255,255,0.55)"
                          : isLightGlass
                            ? "rgba(15,23,42,0.45)"
                            : "rgba(255,255,255,0.22)",
                      }}
                    >
                      {isCollapsed ? `L${level.id}` : `LEVEL ${level.id}`}
                    </span>
                    {!isCollapsed && (
                      <div className="flex items-center justify-center gap-1">
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 500,
                            color: useLightGlassSlateHeader
                              ? "rgba(255,255,255,0.92)"
                              : isLightGlass
                                ? "rgba(15,23,42,0.75)"
                                : "rgba(255,255,255,0.72)",
                            letterSpacing: -0.1,
                            lineHeight: 1.2,
                          }}
                        >
                          {level.name}
                        </span>
                        <BossGridInfoIcon
                          title={`Level ${level.id} · ${level.name}`}
                          header={getLevelInfoHeader(level.id, level.name)}
                          sections={getBossLevelInfoSections(level.id)}
                          variant={glass ? "header" : "default"}
                          panelSize="wide"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span>
                      L{level.id}: {level.name.toUpperCase()}
                    </span>
                    <BossGridInfoIcon
                      title={`Level ${level.id} · ${level.name}`}
                      header={getLevelInfoHeader(level.id, level.name)}
                      sections={getBossLevelInfoSections(level.id)}
                      panelSize="wide"
                    />
                  </div>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {PILLARS.map((pillar, pillarIdx) => {
          const pillarAreas = AREAS.filter((a) => a.pillar === pillar.key);
          const isFirstPillar = pillarIdx === 0;
          return (
            <React.Fragment key={pillar.key}>
              {glass ? (
                <tr>
                  <td
                    colSpan={1 + LEVEL_COLUMNS.length}
                    style={{
                      padding: 0,
                      border: "none",
                      borderBottom: "none",
                      verticalAlign: "middle",
                      background: "transparent",
                    }}
                  >
                    <div
                      className="flex w-full min-w-0 items-center rounded-lg pt-3 pb-0.5 pr-4 text-left"
                      style={{
                        marginTop: isFirstPillar ? GLASS_PILLAR_FIRST_TOP_GAP : GLASS_PILLAR_TOP_GAP,
                        minHeight: 36,
                        paddingLeft: GLASS_AREA_PAD_LEFT,
                        background: "transparent",
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-bold uppercase tracking-[0.14em] sm:text-sm"
                          style={{
                            color: pillar.color,
                            opacity: 0.95,
                          }}
                        >
                          {pillar.name.toUpperCase()}
                        </span>
                        <BossGridInfoIcon
                          title={pillar.name}
                          sections={getBossPillarInfoSections(pillar.key)}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    className="font-medium text-white"
                    style={{
                      padding: "8px 12px",
                      minWidth: CATEGORIES_COL_WIDTH,
                      background: pillar.color,
                      borderBottom: "none",
                      borderRight: "none",
                      ...(isFirstPillar && { borderTopLeftRadius: 6, borderTopRightRadius: 6 }),
                      fontSize: 13.5,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{pillar.name}</span>
                      <BossGridInfoIcon
                        title={pillar.name}
                        sections={getBossPillarInfoSections(pillar.key)}
                        variant="header"
                      />
                    </div>
                  </td>
                  {LEVEL_COLUMNS.map((level) => (
                    <td
                      key={level.id}
                      style={{
                        padding: 0,
                        background: "transparent",
                        border: "none",
                        borderBottom: "none",
                      }}
                    />
                  ))}
                </tr>
              )}
              {pillarAreas.map((area, areaIdx) => {
                const isLastAreaInPillar = areaIdx === pillarAreas.length - 1;
                const areaTopPad = areaIdx === 0 ? GLASS_AREA_PAD_TOP_FIRST : GLASS_AREA_PAD_TOP;
                const areaBottomPad = isLastAreaInPillar ? GLASS_AREA_PAD_BOTTOM_LAST : GLASS_AREA_PAD_BOTTOM;
                const glassAreaLabelPadding = glass
                  ? `${areaTopPad}px 18px ${areaBottomPad}px ${GLASS_AREA_PAD_LEFT}px`
                  : "8px 12px";
                const glassScoreCellPadding = glass
                  ? `${areaIdx === 0 ? 6 : 4}px 6px ${areaBottomPad}px`
                  : 6;
                const glassNamedCellPadding = glass
                  ? `${areaIdx === 0 ? 8 : 6}px 10px ${areaBottomPad}px`
                  : 10;
                const pillarGroupBg =
                  glass && isLightGlass ? hexToRgba(pillar.color, 0.035) : undefined;

                return (
                <tr
                  key={area.id}
                  style={pillarGroupBg ? { background: pillarGroupBg } : undefined}
                >
                  <td
                    className={
                      glass ? (isLightGlass ? "text-slate-700" : "text-slate-200") : "text-slate-600"
                    }
                    style={{
                      padding: glassAreaLabelPadding,
                      borderBottom: glass ? GLASS_AREA_ROW_BORDER : "1px solid #F1F5F9",
                      borderLeft: "none",
                      borderRight: glass ? "none" : undefined,
                      borderTop: "none",
                      verticalAlign: "middle",
                      background: glass ? "transparent" : undefined,
                      fontSize: glass ? 16.5 : undefined,
                    }}
                  >
                    {glass ? (
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            width: 3,
                            height: 26,
                            borderRadius: 2,
                            background: hexToRgba(pillar.color, 0.75),
                            flexShrink: 0,
                          }}
                        />
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="leading-snug">{area.name}</span>
                          <BossGridInfoIcon
                            title={area.name}
                            sections={getBossAreaInfoSections(area.id)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span>{area.name}</span>
                        <BossGridInfoIcon
                          title={area.name}
                          sections={getBossAreaInfoSections(area.id)}
                        />
                      </div>
                    )}
                  </td>
                  {LEVEL_COLUMNS.map((level, levelIdx) => {
                    const playbook = PLAYBOOKS.find((p) => p.level === level.id && p.area === area.id);
                    if (!playbook)
                        return (
                        <td
                          key={`${area.id}-${level.id}`}
                          style={{
                            padding: glassScoreCellPadding,
                            borderBottom: glass ? GLASS_AREA_ROW_BORDER : "1px solid #F1F5F9",
                            verticalAlign: "middle",
                          }}
                        />
                      );
                    const score = answers[playbook.ref] as 0 | 1 | 2 | undefined;
                    const handleClick = () => {
                      if (interactive && onScoreChange) {
                        const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                        onScoreChange(playbook.ref, next);
                      } else if (playbookLinkBase) {
                        router.push(`${playbookLinkBase}/${playbook.ref}`);
                      }
                    };
                    const isClickable = glass
                      ? Boolean(onScoreChange || playbookLinkBase)
                      : Boolean((interactive && onScoreChange) || playbookLinkBase);
                    const glassConfig = score === 0 ? GLASS_CELL.red : score === 1 ? GLASS_CELL.amber : score === 2 ? GLASS_CELL.green : GLASS_CELL.unscored;

                    if (glass) {
                      const isCollapsed = collapsedLevels.has(level.id);
                      // Collapsed column: narrow cell, glass + dot only (no name, no flip).
                      if (isCollapsed) {
                        return (
                          <td
                            key={playbook.ref}
                            style={{
                              padding: glassScoreCellPadding,
                              borderBottom: glass ? GLASS_AREA_ROW_BORDER : "1px solid #F1F5F9",
                              verticalAlign: "middle",
                            }}
                          >
                            <div
                              role={isClickable ? "button" : "gridcell"}
                              tabIndex={isClickable ? 0 : undefined}
                              onClick={
                                isClickable
                                  ? (e: React.MouseEvent<HTMLElement>) => {
                                      if (tryOpenBossScorePanel(playbook.ref, e.currentTarget)) return;
                                      handleClick();
                                    }
                                  : undefined
                              }
                              onKeyDown={
                                isClickable
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        if (tryOpenBossScorePanel(playbook.ref, e.currentTarget as HTMLElement)) return;
                                        if (interactive && onScoreChange) {
                                          const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                                          onScoreChange(playbook.ref, next);
                                        } else if (playbookLinkBase) router.push(`${playbookLinkBase}/${playbook.ref}`);
                                      }
                                    }
                                  : undefined
                              }
                              {...glassQuestionHoverProps(playbook.ref)}
                              className={`${isClickable ? "cursor-pointer " : ""}flex items-center justify-center rounded-md ${outfit.variable}`}
                              style={{
                                fontFamily: "var(--font-outfit), sans-serif",
                                ...getGlassCellStyle(score),
                                minHeight: 44,
                              }}
                              aria-label={playbook.name}
                            >
                              <span
                                className="w-2 h-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: glassConfig.dot,
                                  boxShadow: glassConfig.glow,
                                }}
                              />
                            </div>
                          </td>
                        );
                      }
                      if (glassAlwaysShowPlaybookNames && !isCollapsed) {
                        return (
                          <td
                            key={playbook.ref}
                            style={{
                              padding: glassNamedCellPadding,
                              borderBottom: glass ? GLASS_AREA_ROW_BORDER : "1px solid #F1F5F9",
                              verticalAlign: "middle",
                            }}
                          >
                            <div
                              role={isClickable ? "button" : "gridcell"}
                              tabIndex={isClickable ? 0 : undefined}
                              onClick={
                                isClickable
                                  ? (e: React.MouseEvent<HTMLElement>) => {
                                      if (tryOpenBossScorePanel(playbook.ref, e.currentTarget)) return;
                                      handleClick();
                                    }
                                  : undefined
                              }
                              onKeyDown={
                                isClickable
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        if (tryOpenBossScorePanel(playbook.ref, e.currentTarget as HTMLElement)) return;
                                        if (interactive && onScoreChange) {
                                          const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                                          onScoreChange(playbook.ref, next);
                                        } else if (playbookLinkBase) {
                                          router.push(`${playbookLinkBase}/${playbook.ref}`);
                                        }
                                      }
                                    }
                                  : undefined
                              }
                              {...glassQuestionHoverProps(playbook.ref)}
                              className={`${isClickable ? "cursor-pointer " : ""}flex min-h-[54px] items-center justify-center rounded-lg ${outfit.variable}`}
                              style={{
                                fontFamily: "var(--font-outfit), sans-serif",
                                ...getGlassCellStyle(score),
                                padding: "14px 12px",
                              }}
                              aria-label={playbook.name}
                            >
                              <span
                                className="block w-full break-words text-center text-[15px] font-semibold leading-snug"
                                style={{
                                  color: isLightGlass ? "#0f172a" : "#e2e8f0",
                                }}
                              >
                                {playbook.name}
                              </span>
                            </div>
                          </td>
                        );
                      }
                      // showNamesForScores: show name in cell for these scores; else dot + flip on hover.
                      if (score !== undefined && showNamesForScores.includes(score)) {
                        return (
                          <td
                            key={playbook.ref}
                            style={{
                              padding: glassScoreCellPadding,
                              borderBottom: glass ? GLASS_AREA_ROW_BORDER : "1px solid #F1F5F9",
                              verticalAlign: "middle",
                            }}
                          >
                            <div
                              role={isClickable ? "button" : "gridcell"}
                              tabIndex={isClickable ? 0 : undefined}
                              onClick={
                                isClickable
                                  ? (e: React.MouseEvent<HTMLElement>) => {
                                      if (tryOpenBossScorePanel(playbook.ref, e.currentTarget)) return;
                                      handleClick();
                                    }
                                  : undefined
                              }
                              onKeyDown={
                                isClickable
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        if (tryOpenBossScorePanel(playbook.ref, e.currentTarget as HTMLElement)) return;
                                        if (interactive && onScoreChange) {
                                          const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                                          onScoreChange(playbook.ref, next);
                                        } else if (playbookLinkBase) router.push(`${playbookLinkBase}/${playbook.ref}`);
                                      }
                                    }
                                  : undefined
                              }
                              {...glassQuestionHoverProps(playbook.ref)}
                              className={`${isClickable ? "cursor-pointer " : ""}flex items-center justify-center px-2 rounded-md text-center ${outfit.variable}`}
                              style={{
                                fontFamily: "var(--font-outfit), sans-serif",
                                ...getGlassCellStyle(score),
                                minHeight: 44,
                                color: isLightGlass ? "#1e293b" : "#e2e8f0",
                                fontSize: 15,
                                lineHeight: 1.2,
                                fontWeight: 500,
                              }}
                              aria-label={playbook.name}
                            >
                              <span className="block line-clamp-2">{playbook.name}</span>
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={playbook.ref}
                          style={{
                            padding: glassScoreCellPadding,
                            borderBottom: glass ? GLASS_AREA_ROW_BORDER : "1px solid #F1F5F9",
                            verticalAlign: "middle",
                          }}
                        >
                          <div
                            role={isClickable ? "button" : "gridcell"}
                            tabIndex={isClickable ? 0 : undefined}
                            onClick={
                              isClickable
                                ? (e: React.MouseEvent<HTMLElement>) => {
                                    if (tryOpenBossScorePanel(playbook.ref, e.currentTarget)) return;
                                    handleClick();
                                  }
                                : undefined
                            }
                            onKeyDown={
                              isClickable
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      if (tryOpenBossScorePanel(playbook.ref, e.currentTarget as HTMLElement)) return;
                                      if (interactive && onScoreChange) {
                                        const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                                        onScoreChange(playbook.ref, next);
                                      } else if (playbookLinkBase) router.push(`${playbookLinkBase}/${playbook.ref}`);
                                    }
                                  }
                                : undefined
                            }
                            {...glassQuestionHoverProps(playbook.ref)}
                            className={`${isClickable ? "cursor-pointer " : ""}group/cell ${outfit.variable}`}
                            style={{
                              fontFamily: "var(--font-outfit), sans-serif",
                              height: 44,
                              overflow: "hidden",
                              perspective: 400,
                            }}
                            aria-label={playbook.name}
                          >
                            <div
                              className="relative h-full w-full transition-[transform] duration-300 ease-out group-hover/cell:[transform:rotateY(180deg)]"
                              style={{
                                transformStyle: "preserve-3d",
                                transformOrigin: "center center",
                              }}
                            >
                              {/* Front: glass + dot */}
                              <div
                                className="absolute inset-0 flex items-center justify-center rounded-md"
                                style={{
                                  ...getGlassCellStyle(score),
                                  backfaceVisibility: "hidden",
                                  WebkitBackfaceVisibility: "hidden",
                                  transform: "translateZ(0)",
                                }}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: glassConfig.dot,
                                    boxShadow: glassConfig.glow,
                                  }}
                                />
                              </div>
                              {/* Back: solid same hue (no backdrop-filter) so it always shows when flipped */}
                              <div
                                className="absolute inset-0 flex items-center justify-center px-2 rounded-md text-center"
                                style={{
                                  backfaceVisibility: "hidden",
                                  WebkitBackfaceVisibility: "hidden",
                                  transform: "rotateY(180deg) translateZ(1px)",
                                  background: score === 0 ? FLIP_BACK_BG.red : score === 1 ? FLIP_BACK_BG.amber : score === 2 ? FLIP_BACK_BG.green : FLIP_BACK_BG.unscored,
                                  border: `1px solid ${glassConfig.borderGlow}`,
                                  borderRadius: 6,
                                  minHeight: 44,
                                  color: isLightGlass ? "#1e293b" : "#e2e8f0",
                                  fontSize: 15,
                                  lineHeight: 1.2,
                                  fontWeight: 500,
                                }}
                              >
                                <span className="block line-clamp-2">{playbook.name}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={playbook.ref}
                        style={{
                              padding: glassScoreCellPadding,
                          borderBottom: glass ? GLASS_AREA_ROW_BORDER : "1px solid #F1F5F9",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          role={isClickable ? "button" : "gridcell"}
                          tabIndex={isClickable ? 0 : undefined}
                          onClick={isClickable ? handleClick : undefined}
                          onKeyDown={
                            isClickable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (interactive && onScoreChange) {
                                      const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                                      onScoreChange(playbook.ref, next);
                                    } else if (playbookLinkBase) router.push(`${playbookLinkBase}/${playbook.ref}`);
                                  }
                                }
                              : undefined
                          }
                          className={isClickable ? "cursor-pointer" : ""}
                          style={getCellStyle(score)}
                        >
                          <span className="block whitespace-nowrap truncate" title={playbook.name}>
                            {playbook.name}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
              })}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  if (glass) {
    const labelMuted = isLightGlass ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.75)";
    const countColor = isLightGlass ? "#0f172a" : "rgba(255,255,255,0.9)";
    const scoreBarSegments = [
      { count: scoreCounts.green, dot: "#4ADE80", label: "On track" },
      { count: scoreCounts.amber, dot: "#E5C84A", label: "Building" },
      { count: scoreCounts.red, dot: "#C73E54", label: "Needs attention" },
    ] as const;

    const scoreBar = (
      <div className="flex flex-wrap items-center justify-end gap-3" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
        <div
          className="flex flex-wrap items-center gap-2"
          style={{
            background: isLightGlass ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.25)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${isLightGlass ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)"}`,
            borderRadius: 12,
            padding: "12px 20px",
            boxShadow: isLightGlass ? "0 2px 8px rgba(0,0,0,0.08)" : "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {scoreBarSegments.map((seg) => (
            <span key={seg.label} className="inline-flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: seg.dot }} />
              {scoreBarLabels === "neutral" ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: labelMuted, maxWidth: 100 }} className="leading-tight">
                  {seg.label}
                </span>
              ) : null}
              <span style={{ fontSize: 12, fontWeight: 600, color: countColor }}>{seg.count}</span>
            </span>
          ))}
        </div>
        <div
          style={{
            background: isLightGlass ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.3)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${isLightGlass ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 12,
            padding: "10px 18px",
            display: "flex",
            alignItems: "baseline",
            gap: 4,
            boxShadow: isLightGlass ? "0 2px 8px rgba(0,0,0,0.1)" : "0 4px 16px rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 800, color: isLightGlass ? "#0f172a" : "#fff", letterSpacing: -0.5 }}>
            {totalScore}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: isLightGlass ? "rgba(15,23,42,0.5)" : "rgba(255,255,255,0.4)" }}>
            / 100
          </span>
        </div>
      </div>
    );

    const tableWrapper = isLightGlass ? (
      <div className={`hidden w-full lg:block ${LIGHT_GLASS_CARD_SHELL}`}>
        <div className="overflow-x-auto pb-4 sm:pb-5">{tableContent}</div>
      </div>
    ) : (
      <div
        className="hidden overflow-x-auto rounded-xl px-4 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-2.5 lg:block"
        style={{
          background: tableBg ?? "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        }}
      >
        {tableContent}
      </div>
    );

    if (title) {
      return (
        <>
          {mobileStackedView}
          <div className={`hidden w-full flex-col lg:flex ${outfit.variable}`} style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
            <div
              className="flex w-full flex-wrap items-center justify-between gap-4"
              style={{ padding: "0 0 22px", minHeight: 52 }}
            >
              <h2
                className="text-left font-extrabold leading-tight"
                style={{
                  fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
                  color: isLightGlass ? "#0f172a" : "#fff",
                  letterSpacing: -0.5,
                  margin: 0,
                }}
              >
                {title}
              </h2>
              {!hideGlassScoreBar ? scoreBar : null}
            </div>
            <div className="w-full">{tableWrapper}</div>
          </div>
          <BossQuestionTooltipPortal
            tooltip={tooltip}
            tooltipVisible={tooltipVisible}
            {...tooltipPortalProps}
          />
        </>
      );
    }

    return (
      <>
        {mobileStackedView}
        <div className={`hidden w-full flex-col lg:flex ${outfit.variable}`} style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
          {!hideGlassScoreBar ? <div style={{ padding: "16px 20px 22px" }}>{scoreBar}</div> : null}
          <div className="w-full">{tableWrapper}</div>
        </div>
        <BossQuestionTooltipPortal
          tooltip={tooltip}
          tooltipVisible={tooltipVisible}
          {...tooltipPortalProps}
        />
      </>
    );
  }

  return (
    <>
      {mobileStackedView}
      <div
        className={`hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block ${outfit.variable}`}
        style={{ fontFamily: "var(--font-outfit), sans-serif", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.015)" }}
      >
        {tableContent}
      </div>
    </>
  );
}
