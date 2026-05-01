"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Outfit } from "next/font/google";
import { AREAS, LEVELS, PLAYBOOKS } from "@/lib/bossData";
import { getTotalScore, type AnswersMap } from "@/lib/bossScores";

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
};

// Match Profit System Glass pillar colors
const PILLARS: { key: "foundation" | "vision" | "velocity" | "value"; name: string; color: string }[] = [
  { key: "foundation", name: "Foundation", color: "#A855F7" },
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
const COL_WIDTH = 120;
const CATEGORIES_COL_WIDTH = 160; // First column: pillar/area names on one line
const COL_WIDTH_COLLAPSED = 40; // Collapsed level column: fit +/- and "L1"–"L5"

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
}: BossGridTransposedProps) {
  const router = useRouter();
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(new Set());
  const isLightGlass = glass && glassTheme === "light";
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
      style={{ fontSize: glass ? 14 : 16, tableLayout: "fixed" }}
    >
      <thead>
        <tr>
          <th
            className="text-left font-semibold"
            style={{
              padding: glass ? "14px 16px" : "10px 12px",
              width: CATEGORIES_COL_WIDTH,
              minWidth: CATEGORIES_COL_WIDTH,
              borderBottom: glass
                ? isLightGlass
                  ? "1px solid rgba(0,0,0,0.06)"
                  : "1px solid rgba(255,255,255,0.08)"
                : "2px solid #E2E8F0",
              borderRight: glass ? "none" : undefined,
              background: glass ? "transparent" : "#F8FAFC",
              color:
                glass
                  ? (chromeTextColor ?? (isLightGlass ? "#0f172a" : "#e2e8f0"))
                  : undefined,
            }}
          >
            {glass ? " " : " "}
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
                className={isCollapsed ? "text-center font-semibold" : "text-left font-semibold"}
                style={{
                  padding: isCollapsed ? "14px 8px" : "14px 12px",
                  width: w,
                  minWidth: w,
                  borderBottom: glass
                    ? isLightGlass
                      ? "1px solid rgba(0,0,0,0.06)"
                      : "1px solid rgba(255,255,255,0.08)"
                    : "2px solid #E2E8F0",
                  background: glass ? "transparent" : "#F8FAFC",
                  color:
                    glass
                      ? (chromeTextColor ?? (isLightGlass ? "#334155" : "rgba(255,255,255,0.85)"))
                      : undefined,
                  fontSize: glass ? 12 : undefined,
                  cursor: glass ? "pointer" : undefined,
                }}
                aria-label={glass ? (isCollapsed ? `Expand level ${level.id} (${level.name})` : `Collapse level ${level.id}`) : undefined}
              >
                {glass ? (
                  <div
                    className={`flex w-full flex-col items-center gap-1 ${isCollapsed ? "justify-center" : ""}`}
                  >
                    <span
                      className={isCollapsed ? "text-[11px]" : "min-w-0 truncate text-center"}
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: 2,
                        color: isLightGlass ? "rgba(15,23,42,0.5)" : "rgba(255,255,255,0.22)",
                      }}
                    >
                      {isCollapsed ? `L${level.id}` : `LEVEL ${level.id}`}
                    </span>
                    {!isCollapsed && (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isLightGlass ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.55)",
                          letterSpacing: -0.2,
                        }}
                      >
                        {level.name}
                      </span>
                    )}
                  </div>
                ) : (
                  <>L{level.id}: {level.name.toUpperCase()}</>
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
                      className="flex items-center gap-2.5 py-2 pl-3"
                      style={{
                        marginTop: isFirstPillar ? 0 : 14,
                        borderTop: isFirstPillar
                          ? "none"
                          : isLightGlass
                            ? "1px solid rgba(0,0,0,0.06)"
                            : "1px solid rgba(255, 255, 255, 0.12)",
                        minHeight: 28,
                        background: "transparent",
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 2,
                          borderRadius: 1,
                          background: pillar.color,
                          boxShadow: `0 0 10px ${pillar.color}50`,
                        }}
                      />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          color: pillar.color,
                          opacity: 0.9,
                        }}
                      >
                        {pillar.name.toUpperCase()}
                      </span>
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
                    {pillar.name}
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
              {pillarAreas.map((area) => (
                <tr key={area.id}>
                  <td
                    className={
                      glass ? (isLightGlass ? "text-slate-700" : "text-slate-200") : "text-slate-600"
                    }
                    style={{
                      padding: glass ? "10px 16px" : "8px 12px",
                      borderBottom: glass ? "none" : "1px solid #F1F5F9",
                      borderLeft: "none",
                      borderRight: glass ? "none" : undefined,
                      borderTop: "none",
                      verticalAlign: "middle",
                      background: glass ? "transparent" : undefined,
                      fontSize: glass ? 12 : undefined,
                    }}
                  >
                    {glass ? (
                      <div className="flex items-center gap-2.5">
                        <div
                          style={{
                            width: 2,
                            height: 22,
                            borderRadius: 1,
                            background: hexToRgba(pillar.color, 0.7),
                            flexShrink: 0,
                          }}
                        />
                        <span>{area.name}</span>
                      </div>
                    ) : (
                      area.name
                    )}
                  </td>
                  {LEVEL_COLUMNS.map((level, levelIdx) => {
                    const playbook = PLAYBOOKS.find((p) => p.level === level.id && p.area === area.id);
                    if (!playbook)
                        return (
                        <td
                          key={`${area.id}-${level.id}`}
                          style={{
                            padding: 6,
                            borderBottom:
                              glass
                                ? isLightGlass
                                  ? "1px solid rgba(0,0,0,0.06)"
                                  : "1px solid rgba(255,255,255,0.08)"
                                : "1px solid #F1F5F9",
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
                    const isClickable = (interactive && onScoreChange) || !!playbookLinkBase;
                    const glassConfig = score === 0 ? GLASS_CELL.red : score === 1 ? GLASS_CELL.amber : score === 2 ? GLASS_CELL.green : GLASS_CELL.unscored;

                    if (glass) {
                      const isCollapsed = collapsedLevels.has(level.id);
                      // Collapsed column: narrow cell, glass + dot only (no name, no flip).
                      if (isCollapsed) {
                        return (
                          <td
                            key={playbook.ref}
                            style={{
                              padding: 6,
                              borderBottom: isLightGlass
                                ? "1px solid rgba(0,0,0,0.06)"
                                : "1px solid rgba(255,255,255,0.08)",
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
                      // showNamesForScores: show name in cell for these scores; else dot + flip on hover.
                      if (score !== undefined && showNamesForScores.includes(score)) {
                        return (
                          <td
                            key={playbook.ref}
                            style={{
                              padding: 6,
                              borderBottom: isLightGlass
                                ? "1px solid rgba(0,0,0,0.06)"
                                : "1px solid rgba(255,255,255,0.08)",
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
                            padding: 6,
                            borderBottom: isLightGlass
                              ? "1px solid rgba(0,0,0,0.06)"
                              : "1px solid rgba(255,255,255,0.08)",
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
                          padding: 6,
                          borderBottom: "1px solid #F1F5F9",
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
              ))}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  if (glass) {
    const scoreBar = (
      <div className="flex flex-wrap items-center justify-end gap-3" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
        <div
          className="flex items-center gap-2"
          style={{
            background: isLightGlass ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.25)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${isLightGlass ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)"}`,
            borderRadius: 10,
            padding: "8px 14px",
            boxShadow: isLightGlass ? "0 2px 8px rgba(0,0,0,0.08)" : "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: isLightGlass ? "#0f172a" : "rgba(255,255,255,0.9)" }}>
            {scoreCounts.green}
          </span>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E5C84A" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: isLightGlass ? "#0f172a" : "rgba(255,255,255,0.9)" }}>
            {scoreCounts.amber}
          </span>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C73E54" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: isLightGlass ? "#0f172a" : "rgba(255,255,255,0.9)" }}>
            {scoreCounts.red}
          </span>
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

    const tableWrapper = (
      <div
        className="overflow-x-auto rounded-xl"
        style={
          isLightGlass
            ? {
                background: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
              }
            : {
                background: tableBg ?? "rgba(15, 23, 42, 0.4)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
              }
        }
      >
        {tableContent}
      </div>
    );

    if (title) {
      return (
        <div className={`flex w-full flex-col ${outfit.variable}`} style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
          <div
            className="flex w-full flex-wrap items-center justify-between gap-4"
            style={{ padding: "0 0 16px", minHeight: 48 }}
          >
            <h2
              className="text-left font-extrabold leading-tight"
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
                color: "#fff",
                letterSpacing: -0.5,
                margin: 0,
              }}
            >
              {title}
            </h2>
            {scoreBar}
          </div>
          <div className="mx-auto w-full max-w-full overflow-x-auto" style={{ display: "flex", justifyContent: "center" }}>
            {tableWrapper}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex flex-col ${outfit.variable}`} style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
        <div style={{ padding: "12px 16px 16px" }}>{scoreBar}</div>
        <div className="mx-auto w-full max-w-full overflow-x-auto" style={{ display: "flex", justifyContent: "center" }}>
          {tableWrapper}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm ${outfit.variable}`}
      style={{ fontFamily: "var(--font-outfit), sans-serif", boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.015)" }}
    >
      {tableContent}
    </div>
  );
}
