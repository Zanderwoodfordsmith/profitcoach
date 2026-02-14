"use client";

const WHEEL_AREAS = [
  "Owner",
  "Vision",
  "Strategy",
  "Planning",
  "Profit",
  "Revenue",
  "Operations",
  "Financials",
  "Systems",
  "Team",
];

/** Sample scores 0–100 for preview; in real results these come from assessment. */
const SAMPLE_SCORES = [55, 45, 60, 50, 65, 40, 55, 50, 45, 60];

function getPoint(angleDeg: number, radius: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

export function BossWheel({ size = 280 }: { size?: number }) {
  const scores = SAMPLE_SCORES;
  const max = 100;
  const r = 42;
  const points = scores.map((score, i) => {
    const angle = (360 / scores.length) * i;
    const radius = (score / max) * r;
    return getPoint(angle, radius);
  });
  const fillPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const axisPoints = scores.map((_, i) => {
    const angle = (360 / scores.length) * i;
    const end = getPoint(angle, r);
    return { end, label: WHEEL_AREAS[i] };
  });

  return (
    <figure className="flex flex-col items-center">
      <svg
        viewBox="0 0 100 100"
        className="w-full max-w-[280px] text-slate-300"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* Grid circles */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx="50"
            cy="50"
            r={r * scale}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="0.4"
          />
        ))}
        {/* Axes */}
        {axisPoints.map(({ end }, i) => (
          <line
            key={i}
            x1="50"
            y1="50"
            x2={end.x}
            y2={end.y}
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="0.4"
          />
        ))}
        {/* Fill */}
        <polygon
          points={fillPoints}
          fill="#0c5290"
          fillOpacity="0.4"
          stroke="#0c5290"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Center dot */}
        <circle cx="50" cy="50" r="2" fill="#0c5290" />
      </svg>
      <figcaption className="mt-2 text-center text-xs font-medium text-slate-600">
        Your BOSS Wheel — see the shape of your business at a glance
      </figcaption>
    </figure>
  );
}
