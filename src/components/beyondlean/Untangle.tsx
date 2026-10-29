"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const LANES = ["Enquiries", "Quotes", "Orders", "Hiring", "Cash", "Suppliers", "Complaints"];
const CENTRE = { x: 500, y: 285 };
const EXIT_ORDER = [3, 6, 0, 5, 1, 4, 2];
const SWING_IN = [-140, 120, -90, 160, -170, 80, -110];
const SWING_OUT = [130, -150, 100, -120, 90, -160, 140];
const GATES = [
  { x: 320, label: "Score" },
  { x: 500, label: "Plan" },
  { x: 680, label: "Fix and measure" },
];

const laneY = (i: number) => 120 + i * 55;

/** Every lane is two cubic curves, so the tangled and straight shapes share one set of numbers to blend. */
function lanePoints(i: number) {
  const y = laneY(i);
  const yOut = laneY(EXIT_ORDER[i]);
  const a = SWING_IN[i];
  const b = SWING_OUT[i];
  const tangled = [150, y, 300, y + a, 400, CENTRE.y - a * 0.8, CENTRE.x, CENTRE.y, 600, CENTRE.y + b * 0.8, 720, yOut - b, 880, yOut];
  const straight = [150, y, 300, y, 400, y, 500, y, 600, y, 720, y, 880, y];
  return { tangled, straight };
}

const LANE_POINTS = LANES.map((_, i) => lanePoints(i));

function pathFor(points: number[]) {
  const [x0, y0, ...rest] = points;
  const n = rest.map((v) => v.toFixed(1));
  return `M${x0} ${y0} C${n[0]} ${n[1]} ${n[2]} ${n[3]} ${n[4]} ${n[5]} C${n[6]} ${n[7]} ${n[8]} ${n[9]} ${n[10]} ${n[11]}`;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export function Untangle({ scoreHref }: { scoreHref: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setP(1);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const travel = section.offsetHeight - window.innerHeight;
      const raw = travel > 0 ? clamp(-rect.top / travel) : 1;
      setP(ease(clamp((raw - 0.18) / 0.6)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const resolved = p > 0.55;
  const you = { x: CENTRE.x, y: CENTRE.y + (40 - CENTRE.y) * p };

  return (
    <section ref={sectionRef} className={`bp-untangle${resolved ? " is-resolved" : ""}`} aria-labelledby="bp-untangle-a">
      <div className="bp-untangle-stage">
        <div className="bp-wrap bp-untangle-grid">
          <div className="bp-untangle-copy">
            <div className="bp-untangle-state bp-untangle-a" aria-hidden={resolved}>
              <h2 id="bp-untangle-a" className="bp-display">
                Today, everything runs <em>through you.</em>
              </h2>
              <p>Every quote, question and problem waits for you. So the business only moves as fast as you do.</p>
            </div>
            <div className="bp-untangle-state bp-untangle-b" aria-hidden={!resolved}>
              <h2 className="bp-display">
                Measure first. <em>Then fix what matters most.</em>
              </h2>
              <p>
                Each kind of work gets a clear owner and a simple way of doing it. You steer from above instead of
                firefighting in the middle.
              </p>
              <a className="bp-link" href={scoreHref} tabIndex={resolved ? 0 : -1}>
                Get your free BOSS Score
                <ArrowRight aria-hidden />
              </a>
            </div>
          </div>

          <svg
            className="bp-untangle-svg"
            viewBox="0 0 1000 540"
            role="img"
            aria-label="Seven kinds of work, from enquiries to complaints, all routed through the owner. As you scroll they straighten into clean lanes and the owner moves out of the middle."
          >
            {GATES.map((g) => (
              <g key={g.label} className="bp-gate" style={{ opacity: clamp((p - 0.6) / 0.4) }}>
                <line x1={g.x} x2={g.x} y1={92} y2={478} />
                <text x={g.x} y={510} textAnchor="middle">
                  {g.label}
                </text>
              </g>
            ))}

            {LANE_POINTS.map(({ tangled, straight }, i) => {
              const t = ease(clamp((p - i * 0.035) / (1 - 6 * 0.035)));
              const d = pathFor(tangled.map((v, k) => v + (straight[k] - v) * t));
              const end = { x: 880, y: tangled[13] + (straight[13] - tangled[13]) * t };
              return (
                <g key={LANES[i]} className="bp-lane">
                  <path className="bp-lane-base" d={d} />
                  <path className="bp-lane-flow" d={d} style={{ opacity: t }} />
                  <circle className="bp-lane-start" cx={150} cy={laneY(i)} r={5} />
                  <circle className="bp-lane-end" cx={end.x} cy={end.y} r={5} />
                  <text className="bp-lane-label" x={132} y={laneY(i) + 5} textAnchor="end">
                    {LANES[i]}
                  </text>
                </g>
              );
            })}

            <g className="bp-you" transform={`translate(${you.x} ${you.y})`}>
              <circle r={34} />
              <text y={6} textAnchor="middle">
                You
              </text>
            </g>
            <text className="bp-you-note" x={you.x + 50} y={you.y + 6} style={{ opacity: clamp((p - 0.7) / 0.3) }}>
              Out of the middle
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
