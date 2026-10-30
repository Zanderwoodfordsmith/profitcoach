/**
 * The BOSS wheel with every area muted and the weakest one lit red as "Your constraint".
 * Same drawing as the LinkedIn Featured card (scripts/linkedin-featured/render.mjs).
 */
const AREA = ["#4C667A", "#0C5290", "#0C5290", "#0C5290", "#42A1EE", "#42A1EE", "#42A1EE", "#1CA0C2", "#1CA0C2", "#1CA0C2"];
const SCORES = [0.55, 0.72, 0.46, 0.6, 0.82, 0.5, 0.66, 0.4, 0.76, 0.58];
const GROUPS: [number, number, string][] = [
  [0, 1, "#4C667A"],
  [1, 4, "#0C5290"],
  [4, 7, "#42A1EE"],
  [7, 10, "#1CA0C2"],
];
const SIZE = 480;
const FOCUS = 7;

function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (r0 === 0) return `M ${cx} ${cy} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} Z`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

export function ConstraintWheel({ ground = "#F6F8FB", dark = false }: { ground?: string; dark?: boolean }) {
  const r = SIZE / 2;
  const R = r * 0.86;
  const step = (Math.PI * 2) / 10;
  const start = -Math.PI / 2 - step / 2;
  const a = start + (FOCUS + 0.5) * step;
  const tip = R * SCORES[FOCUS] + 26;
  const x = r + tip * Math.cos(a);
  const y = r + tip * Math.sin(a);
  const w = 176;

  return (
    <svg
      className="v5-cwheel"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="The ten areas of a business, with the weakest one marked as your constraint"
    >
      {AREA.map((fill, i) => {
        const a0 = start + i * step;
        const a1 = a0 + step;
        return (
          <g key={i}>
            <path d={wedge(r, r, 0, R, a0, a1)} fill={dark ? "#8cc4ff" : fill} opacity={dark ? 0.08 : 0.1} stroke={ground} strokeWidth={3} />
            <path
              d={wedge(r, r, 0, R * SCORES[i], a0, a1)}
              fill={i === FOCUS ? "#EF4444" : dark ? "rgba(203, 225, 248, 0.42)" : "#CBD5E1"}
              stroke={ground}
              strokeWidth={3}
            />
          </g>
        );
      })}
      {GROUPS.map(([g0, g1, col]) => (
        <path
          key={g0}
          d={wedge(r, r, R * 1.05, R * 1.14, start + g0 * step + 0.02, start + g1 * step - 0.02)}
          fill={dark ? "#8cc4ff" : col}
          opacity={dark ? 0.3 : 0.35}
        />
      ))}
      <rect x={x - w} y={y - 4} width={w} height={40} rx={20} fill="#DC2626" />
      <text x={x - w / 2} y={y + 22} textAnchor="middle" fontWeight={700} fontSize={18} fill="#fff">
        Your constraint
      </text>
    </svg>
  );
}
