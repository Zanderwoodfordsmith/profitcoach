/* global React */

// BOSS Wheel — radar chart of the 10 ADD PROFIT areas, scored 0-100.
// Three sizes: 'sm' (compact, no labels), 'md' (with labels), 'lg' (full).
// Animates entry: rings draw, axes fade, scored polygon fills.

const BOSS_AREAS = [
  { key: "owner", label: "Owner", short: "Owner", score: 72 },
  { key: "vision", label: "Vision", short: "Vision", score: 60 },
  { key: "strategy", label: "Strategy", short: "Strategy", score: 48 },
  { key: "marketing", label: "Marketing", short: "Marketing", score: 35 },
  { key: "sales", label: "Sales", short: "Sales", score: 42 },
  { key: "delivery", label: "Delivery", short: "Delivery", score: 65 },
  { key: "team", label: "Team", short: "Team", score: 30 },
  { key: "systems", label: "Systems", short: "Systems", score: 38 },
  { key: "finance", label: "Finance & Profit", short: "Finance", score: 55 },
  { key: "exit", label: "Value & Exit", short: "Value", score: 28 },
];

const TARGET_AREAS = BOSS_AREAS.map(a => ({ ...a, score: 90 }));

function pointAt(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function BossWheel({ size = 520, showLabels = true, withTarget = true, animated = true, scoreOverride = null, label = "Your BOSS Score" }) {
  const { useEffect, useRef, useState } = React;
  const cx = size / 2;
  const cy = size / 2;
  const padding = showLabels ? 90 : 30;
  const r = (size / 2) - padding;
  const N = BOSS_AREAS.length;
  const angles = Array.from({ length: N }, (_, i) => (-Math.PI / 2) + (i * 2 * Math.PI / N));

  // Animation: 0 -> 1
  const [t, setT] = useState(animated ? 0 : 1);
  const ref = useRef(null);
  useEffect(() => {
    if (!animated) return;
    let raf, started = null;
    const dur = 1400;
    let triggered = false;
    const start = () => {
      if (triggered) return; triggered = true;
      const tick = (ts) => {
        if (started == null) started = ts;
        const k = Math.min(1, (ts - started) / dur);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - k, 3);
        setT(eased);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) start(); });
    }, { threshold: 0.25 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [animated]);

  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Score polygon
  const score = scoreOverride || BOSS_AREAS;
  const scorePts = score.map((a, i) => {
    const v = (a.score / 100) * t;
    return pointAt(cx, cy, r * v, angles[i]);
  });
  const scorePath = scorePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';

  const targetPts = TARGET_AREAS.map((a, i) => pointAt(cx, cy, r * (a.score / 100), angles[i]));
  const targetPath = targetPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';

  // Avg
  const avg = Math.round(score.reduce((s, a) => s + a.score, 0) / score.length);

  return (
    <div ref={ref} style={{ position: "relative", width: size, maxWidth: "100%", margin: "0 auto" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <radialGradient id="bw-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#42a1ee" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0c5290" stopOpacity="0.35" />
          </radialGradient>
          <linearGradient id="bw-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#42a1ee" />
            <stop offset="100%" stopColor="#0c5290" />
          </linearGradient>
        </defs>

        {/* Concentric rings */}
        {rings.map((rr, i) => (
          <circle key={rr} cx={cx} cy={cy} r={r * rr}
            fill={i === rings.length - 1 ? "rgba(241,245,249,0.5)" : "none"}
            stroke="rgba(12,82,144,0.10)" strokeWidth="1" strokeDasharray={i === rings.length - 1 ? "0" : "3 4"} />
        ))}

        {/* Axes */}
        {angles.map((a, i) => {
          const [x2, y2] = pointAt(cx, cy, r, a);
          return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(12,82,144,0.10)" strokeWidth="1" />;
        })}

        {/* Target outline */}
        {withTarget && (
          <path d={targetPath} fill="none" stroke="#10b981" strokeWidth="1.25" strokeDasharray="4 4" opacity={0.6 * t} />
        )}

        {/* Score polygon */}
        <path d={scorePath} fill="url(#bw-fill)" stroke="url(#bw-stroke)" strokeWidth="2" strokeLinejoin="round" />

        {/* Score points */}
        {scorePts.map((p, i) => {
          const v = score[i].score;
          const c = v >= 65 ? "#10b981" : v >= 45 ? "#f59e0b" : "#e11d48";
          return (
            <g key={i} opacity={t}>
              <circle cx={p[0]} cy={p[1]} r={4.5} fill="#fff" stroke={c} strokeWidth="2" />
            </g>
          );
        })}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={3} fill="#0c5290" />

        {/* Labels */}
        {showLabels && angles.map((a, i) => {
          const [lx, ly] = pointAt(cx, cy, r + 28, a);
          // Anchor based on position
          let anchor = "middle";
          if (lx < cx - 6) anchor = "end";
          else if (lx > cx + 6) anchor = "start";
          const v = score[i].score;
          const c = v >= 65 ? "#10b981" : v >= 45 ? "#f59e0b" : "#e11d48";
          return (
            <g key={i}>
              <text x={lx} y={ly - 6} textAnchor={anchor}
                style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 12, fill: "#0f172a", letterSpacing: "-0.01em" }}>
                {score[i].label}
              </text>
              <text x={lx} y={ly + 10} textAnchor={anchor}
                style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500, fontSize: 11, fill: c, fontVariantNumeric: "tabular-nums" }}>
                {Math.round(score[i].score * t)}
              </text>
            </g>
          );
        })}

        {/* Center score */}
        {showLabels && (
          <g>
            <text x={cx} y={cy - 4} textAnchor="middle"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 38, fill: "#0c5290", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
              {Math.round(avg * t)}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 9, fill: "#64748b", letterSpacing: "0.22em", textTransform: "uppercase" }}>
              BOSS Score
            </text>
          </g>
        )}
      </svg>

      {showLabels && withTarget && (
        <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 8, fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.06em" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 3, background: "linear-gradient(90deg,#42a1ee,#0c5290)", borderRadius: 2 }}></span>
            Today
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 0, borderTop: "2px dashed #10b981" }}></span>
            Target
          </span>
        </div>
      )}
    </div>
  );
}

window.BossWheel = BossWheel;
window.BOSS_AREAS = BOSS_AREAS;
