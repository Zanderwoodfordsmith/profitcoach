"use client";

import { useState, useEffect } from "react";
import { Outfit } from "next/font/google";
import { AREAS, LEVELS, PLAYBOOKS } from "@/lib/bossData";
import { getTotalScore, type AnswersMap } from "@/lib/bossScores";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

/** Display order: Level 1 (Overwhelm) … Level 5 (Owner) */
const DISPLAY_LEVELS = [...LEVELS].sort((a, b) => a.id - b.id);

const PILLAR_CONFIG = [
  { name: "Foundation", color: "#A855F7", pillar: "foundation" as const },
  { name: "Clarify Vision", color: "#3B82F6", pillar: "vision" as const },
  { name: "Control Velocity", color: "#0EA5E9", pillar: "velocity" as const },
  { name: "Create Value", color: "#14B8A6", pillar: "value" as const },
];

/** Build rows: each pillar has areas; each area has 5 cells (one per level). */
function getPillarAreas() {
  return PILLAR_CONFIG.map((config) => ({
    ...config,
    areas: AREAS.filter((a) => a.pillar === config.pillar).map((a) => ({
      ref: a.id,
      name: a.name,
      pbs: DISPLAY_LEVELS.map((lv) => {
        const playbook = PLAYBOOKS.find((p) => p.level === lv.id && p.area === a.id);
        return { l: lv.id, t: playbook?.name ?? "-", ref: playbook?.ref };
      }),
    })),
  }));
}

function genDemoScores(): Record<string, "red" | "amber" | "green" | "unscored"> {
  const s: Record<string, "red" | "amber" | "green" | "unscored"> = {};
  PLAYBOOKS.forEach((p) => {
    const r = Math.random();
    if (p.level >= 4 && r < 0.25) s[p.ref] = "unscored";
    else if (p.level === 3 && r < 0.1) s[p.ref] = "unscored";
    else {
      const r2 = Math.random();
      s[p.ref] = r2 < 0.35 ? "red" : r2 < 0.65 ? "amber" : "green";
    }
  });
  return s;
}

function answersToStatusMap(answers: AnswersMap): Record<string, "red" | "amber" | "green" | "unscored"> {
  const s: Record<string, "red" | "amber" | "green" | "unscored"> = {};
  PLAYBOOKS.forEach((p) => {
    const v = answers[p.ref];
    if (v === undefined) s[p.ref] = "unscored";
    else if (v === 0) s[p.ref] = "red";
    else if (v === 1) s[p.ref] = "amber";
    else s[p.ref] = "green";
  });
  return s;
}

const STATUS = {
  green: {
    bg: "rgba(34,197,94,0.28)",
    bgH: "rgba(34,197,94,0.40)",
    border: "rgba(34,197,94,0.38)",
    borderH: "rgba(34,197,94,0.58)",
    dot: "#4ADE80",
    dotGlow: "0 0 14px rgba(74,222,128,0.55)",
    text: "rgba(255,255,255,0.95)",
    weight: 510,
    glow: "inset 0 0 24px rgba(34,197,94,0.12), 0 0 20px rgba(34,197,94,0.14)",
  },
  amber: {
    bg: "rgba(210,180,80,0.12)",
    bgH: "rgba(210,180,80,0.20)",
    border: "rgba(210,180,80,0.18)",
    borderH: "rgba(210,180,80,0.35)",
    dot: "#E5C84A",
    dotGlow: "0 0 10px rgba(229,200,74,0.4)",
    text: "rgba(255,255,255,0.92)",
    weight: 480,
    glow: "inset 0 0 20px rgba(210,180,80,0.04)",
  },
  red: {
    bg: "rgba(185,65,85,0.22)",
    bgH: "rgba(185,65,85,0.32)",
    border: "rgba(185,65,85,0.28)",
    borderH: "rgba(185,65,85,0.45)",
    dot: "#C73E54",
    dotGlow: "0 0 10px rgba(199,62,84,0.35)",
    text: "rgba(255,255,255,0.92)",
    weight: 480,
    glow: "inset 0 0 18px rgba(185,65,85,0.08)",
  },
  unscored: {
    bg: "rgba(255,255,255,0.02)",
    bgH: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.05)",
    borderH: "rgba(255,255,255,0.10)",
    dot: "rgba(255,255,255,0.15)",
    dotGlow: "none",
    text: "rgba(255,255,255,0.30)",
    weight: 380,
    glow: "none",
  },
};

type StatusKey = keyof typeof STATUS;

function GlassCell({
  label,
  status,
  showLabel,
  visible,
}: {
  label: string;
  status: StatusKey;
  showLabel: boolean;
  visible: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const st = STATUS[status];
  const revealed = visible || hovered;
  const showText = showLabel || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 52,
        borderRadius: 12,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        background: revealed ? (hovered ? st.bgH : st.bg) : "rgba(255,255,255,0.025)",
        border: `1px solid ${revealed ? (hovered ? st.borderH : st.border) : "rgba(255,255,255,0.05)"}`,
        backdropFilter: revealed ? "blur(16px) saturate(1.5)" : "blur(8px)",
        WebkitBackdropFilter: revealed ? "blur(16px) saturate(1.5)" : "blur(8px)",
        boxShadow: revealed ? st.glow : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: hovered ? "scale(1.025)" : "scale(1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.02)",
          backdropFilter: revealed ? "blur(0px)" : "blur(3px)",
          WebkitBackdropFilter: revealed ? "blur(0px)" : "blur(3px)",
          transition: "all 0.4s ease",
          opacity: revealed ? 0 : 1,
          pointerEvents: "none",
          borderRadius: 12,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {!showText && revealed && status !== "unscored" && (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: st.dot,
              boxShadow: st.dotGlow,
              transition: "all 0.3s ease",
            }}
          />
        )}
        {!revealed && status !== "unscored" && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: st.dot,
              opacity: 0.25,
              transition: "all 0.3s ease",
            }}
          />
        )}
        {showText && (
          <span
            style={{
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: 12.5,
              fontWeight: st.weight,
              color: st.text,
              letterSpacing: -0.1,
              textAlign: "center",
              lineHeight: 1.25,
              padding: "0 8px",
              transition: "opacity 0.3s ease",
            }}
          >
            {label}
          </span>
        )}
        {status === "unscored" && !hovered && (
          <span
            style={{
              width: 16,
              height: 1,
              borderRadius: 1,
              background: "rgba(255,255,255,0.08)",
            }}
          />
        )}
      </div>
    </div>
  );
}

export type BossGridProfitSystemGlassProps = {
  /** When provided, uses real scores (0=red, 1=amber, 2=green). When omitted, uses random demo scores. */
  answers?: AnswersMap;
  /** Optional title override */
  title?: string;
  /** Optional subtitle override */
  subtitle?: string;
};

export function BossGridProfitSystemGlass({
  answers,
  title = "The Profit System",
  subtitle = "Growth Matrix",
}: BossGridProfitSystemGlassProps) {
  const [demoScores, setDemoScores] = useState<Record<string, StatusKey>>({});
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState({ red: true, amber: true, green: true });

  const useDemo = answers === undefined;
  const scores: Record<string, StatusKey> = useDemo
    ? demoScores
    : (answersToStatusMap(answers) as Record<string, StatusKey>);

  useEffect(() => {
    if (useDemo) setDemoScores(genDemoScores());
    setTimeout(() => setMounted(true), 50);
  }, [useDemo]);

  const toggleFilter = (f: "red" | "amber" | "green") =>
    setFilters((prev) => ({ ...prev, [f]: !prev[f] }));

  const scored = Object.entries(scores).filter(([, v]) => v !== "unscored");
  const total = useDemo
    ? scored.reduce((s, [, v]) => s + (v === "green" ? 2 : v === "amber" ? 1 : 0), 0)
    : getTotalScore(answers ?? null);
  const cnt = (st: StatusKey) => Object.values(scores).filter((s) => s === st).length;

  const pillars = getPillarAreas();

  return (
    <div
      className={outfit.variable}
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(145deg, #0B1628 0%, #0E1F3D 25%, #0C2340 45%, #0A2038 60%, #091A30 80%, #0B1628 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-outfit), sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 5px; width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 3px; }
      `}</style>

      {/* Background orbs */}
      <div
        style={{
          position: "absolute",
          top: -150,
          left: -100,
          width: 650,
          height: 650,
          background:
            "radial-gradient(circle, rgba(59,130,246,0.20) 0%, rgba(59,130,246,0.05) 40%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 50,
          right: -120,
          width: 750,
          height: 750,
          background:
            "radial-gradient(circle, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.04) 40%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -200,
          left: "20%",
          width: 700,
          height: 700,
          background:
            "radial-gradient(circle, rgba(20,184,166,0.16) 0%, rgba(20,184,166,0.03) 40%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: -60,
          width: 450,
          height: 450,
          background:
            "radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 60%)",
          borderRadius: "50%",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "28px 28px 40px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 16,
            opacity: mounted ? 1 : 0,
            transition: "all 0.5s ease",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "rgba(255,255,255,0.25)",
                margin: "0 0 4px",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {subtitle}
            </p>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: 0,
                letterSpacing: -1,
                background: "linear-gradient(135deg, #fff 0%, rgba(186,230,253,0.7) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {title}
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                gap: 3,
                background: "rgba(0,0,0,0.25)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: 12,
                padding: 6,
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {(
                [
                  { key: "green" as const, dot: "#4ADE80", count: cnt("green") },
                  { key: "amber" as const, dot: "#FFD43B", count: cnt("amber") },
                  { key: "red" as const, dot: "#FB7185", count: cnt("red") },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => toggleFilter(f.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 9,
                    border: "none",
                    background: filters[f.key] ? "rgba(255,255,255,0.08)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    opacity: filters[f.key] ? 1 : 0.3,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: f.dot,
                      boxShadow: filters[f.key] ? `0 0 10px ${f.dot}50` : "none",
                      transition: "all 0.2s ease",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 550,
                      color: "rgba(255,255,255,0.55)",
                      fontFamily: "var(--font-outfit), sans-serif",
                    }}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: "12px 24px",
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: -1,
                }}
              >
                {total}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 450,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                / 100
              </span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow:
              "0 8px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
            overflow: "hidden",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "none" : "translateY(14px)",
            transition: "all 0.7s cubic-bezier(0.4,0,0.2,1) 0.1s",
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "200px repeat(5, 1fr)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ padding: "16px 20px" }} />
            {DISPLAY_LEVELS.map((lv) => (
              <div
                key={lv.id}
                style={{
                  padding: "14px 8px",
                  textAlign: "center",
                  borderLeft: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: "rgba(255,255,255,0.18)",
                    marginBottom: 3,
                  }}
                >
                  LEVEL {lv.id}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 620,
                    color: "rgba(255,255,255,0.50)",
                    letterSpacing: -0.2,
                  }}
                >
                  {lv.name}
                </div>
              </div>
            ))}
          </div>

          {/* Rows */}
          {pillars.map((pillar, pi) => (
            <div key={pillar.name}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  borderTop: pi > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  background: "transparent",
                }}
              >
                <div
                  style={{
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
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
                    style={{
                      fontSize: 10,
                      fontWeight: 660,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: pillar.color,
                      opacity: 0.75,
                    }}
                  >
                    {pillar.name}
                  </span>
                </div>
                <div />
              </div>

              {pillar.areas.map((area) => (
                <div
                  key={area.ref}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px repeat(5, 1fr)",
                    borderTop: "1px solid rgba(255,255,255,0.02)",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 2,
                        height: 26,
                        borderRadius: 1,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 470,
                        color: "rgba(255,255,255,0.50)",
                        letterSpacing: -0.1,
                      }}
                    >
                      {area.name}
                    </span>
                  </div>

                  {area.pbs.map((pb) => {
                    const status = (pb.ref ? scores[pb.ref] : "unscored") as StatusKey;
                    const isFiltered =
                      status !== "unscored" && filters[status as "red" | "amber" | "green"];
                    return (
                      <div
                        key={pb.l}
                        style={{
                          padding: "5px 4px",
                          borderLeft: "1px solid rgba(255,255,255,0.02)",
                        }}
                      >
                        <GlassCell
                          label={pb.t}
                          status={status}
                          showLabel={!!isFiltered}
                          visible={!!isFiltered}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer legend */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 20,
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.5s ease 0.4s",
          }}
        >
          {[
            { label: "In place", dot: "#4ADE80" },
            { label: "In progress", dot: "#FFD43B" },
            { label: "To activate", dot: "#FB7185" },
            {
              label: "Not scored",
              dot: "rgba(255,255,255,0.15)",
              dashed: true,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: item.dot,
                  border:
                    "dashed" in item && item.dashed
                      ? "1px dashed rgba(255,255,255,0.15)"
                      : "none",
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  color: "rgba(255,255,255,0.28)",
                  fontWeight: 400,
                  letterSpacing: 0.3,
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
