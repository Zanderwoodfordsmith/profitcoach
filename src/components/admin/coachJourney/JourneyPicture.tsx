"use client";

import { useEffect, useId, useState, type ComponentType } from "react";
import {
  CalendarCheck,
  ClipboardCheck,
  MessageCircle,
  Repeat,
  Rocket,
  Trophy,
  UserPlus,
  UserRound,
  Video,
  type LucideProps,
} from "lucide-react";

import { JOURNEY_MOMENTS, JOURNEY_PHASES } from "@/lib/activation/coachJourney";

/**
 * The journey as one picture (28 Nov, Zander: "a visual, like our system
 * diagram, where it flows"). One road through the nine phases: the phase on
 * top, its milestone on the road, and what we do if something hasn't happened
 * as a dashed detour below that rejoins the road. Drawn from the same data as
 * the table. Click a phase to see its moments in the table.
 */

const W = 1440;
const H = 452;
const X0 = 100;
const STEP = 150;
const ROAD_Y = 236;
const WAVE = 26;

const ICONS: Record<string, ComponentType<LucideProps>> = {
  paid: UserPlus,
  kickoff: Video,
  profile: UserRound,
  live: Rocket,
  "first-reply": MessageCircle,
  booked: CalendarCheck,
  "first-client": Trophy,
  review: ClipboardCheck,
};

/** Height of the road at x: it waves through the stations, so a cosine follows it closely. */
function roadYAt(x: number): number {
  const t = (x - X0) / STEP;
  const i = Math.floor(t);
  const sign = i % 2 ? 1 : -1;
  return ROAD_Y + sign * WAVE * Math.cos(Math.PI * (t - i));
}

/** A smooth road through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(pts: [number, number][]): string {
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function JourneyPicture({ onOpenPhase }: { onOpenPhase: (phaseId: string) => void }) {
  const gid = useId().replace(/:/g, "");
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const stations = JOURNEY_PHASES.map((phase, i) => {
    const x = X0 + i * STEP;
    const y = ROAD_Y + (i % 2 ? WAVE : -WAVE);
    const moments = JOURNEY_MOMENTS.filter((m) => m.phase === phase.id);
    return {
      phase,
      x,
      y,
      milestone: moments.find((m) => m.milestone),
      checks: moments.filter((m) => m.kind === "check"),
    };
  });
  const road = smoothPath([[24, ROAD_Y], ...stations.map((s) => [s.x, s.y] as [number, number]), [W - 24, ROAD_Y]]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[1080px]"
          role="img"
          aria-label="The coach journey: nine phases from joining to month 7, each with its milestone and what we do if something hasn't happened"
        >
          <defs>
            <linearGradient id={`road-${gid}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#051e36" />
              <stop offset="48%" stopColor="#0c5290" />
              <stop offset="100%" stopColor="#1a8fd4" />
            </linearGradient>
          </defs>

          {/* Hover highlight sits behind the road. */}
          {stations.map(({ phase, x }) =>
            hover === phase.id ? (
              <rect key={phase.id} x={x - STEP / 2 + 6} y={24} width={STEP - 12} height={H - 38} rx={8} className="fill-sky-50" />
            ) : null
          )}

          {/* The road, drawn in once. */}
          <path
            d={road}
            fill="none"
            stroke={`url(#road-${gid})`}
            strokeWidth={18}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            className="transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none"
          />
          <path
            d={road}
            fill="none"
            stroke="white"
            strokeOpacity={drawn ? 0.55 : 0}
            strokeWidth={2}
            strokeDasharray="10 12"
            className="transition-[stroke-opacity] delay-1000 duration-500 motion-reduce:transition-none"
          />

          <text x={24} y={ROAD_Y + 34} className="fill-slate-500 text-[12px]">
            Joins
          </text>
          <text x={W - 24} y={ROAD_Y - 22} textAnchor="end" className="fill-slate-500 text-[12px]">
            Month 7
          </text>

          {stations.map(({ phase, x, y, milestone, checks }, i) => {
            const Icon = milestone ? ICONS[milestone.id] : Repeat;
            const active = hover === phase.id;
            // The detour leaves and rejoins the road just after the station.
            const ax = x + 44;
            const bx = x + 98;
            const ay = roadYAt(ax) + 6;
            const by = roadYAt(bx) + 6;
            const mid = (ax + bx) / 2;
            const low = Math.max(ay, by) + 84;
            return (
              <g
                key={phase.id}
                role="button"
                tabIndex={0}
                aria-label={`${phase.name}, ${phase.when}. Show its moments in the table`}
                onClick={() => onOpenPhase(phase.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenPhase(phase.id);
                  }
                }}
                onMouseEnter={() => setHover(phase.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(phase.id)}
                onBlur={() => setHover(null)}
                className="cursor-pointer outline-none"
                style={{
                  opacity: drawn ? 1 : 0,
                  transition: "opacity 400ms ease-out",
                  transitionDelay: `${200 + i * 110}ms`,
                }}
              >
                {/* Hit area for the whole column. */}
                <rect x={x - STEP / 2} y={20} width={STEP} height={H - 30} fill="transparent" />

                {/* Phase */}
                <text x={x} y={58} textAnchor="middle" className="fill-slate-900 text-[15px] font-semibold">
                  {phase.name}
                </text>
                <text x={x} y={78} textAnchor="middle" className="fill-slate-500 text-[12px]">
                  {phase.when}
                </text>

                {/* Milestone, above the road */}
                {milestone ? (
                  <text x={x} y={y - 40} textAnchor="middle" className="fill-[#0c5290] text-[13px] font-semibold">
                    {milestone.milestone}
                  </text>
                ) : (
                  <text x={x} y={y - 40} textAnchor="middle" className="fill-[#0c5290] text-[13px] font-semibold">
                    Result every 3 months
                  </text>
                )}

                {/* Station */}
                <circle cx={x} cy={y} r={21} fill="white" stroke={active ? "#1a8fd4" : "#0c5290"} strokeWidth={3} />
                {Icon ? <Icon x={x - 10} y={y - 10} width={20} height={20} color="#0c5290" strokeWidth={2} aria-hidden /> : null}
                {milestone ? (
                  <text x={x} y={y + 40} textAnchor="middle" className="fill-sky-700 text-[12px] font-medium">
                    {milestone.target}
                  </text>
                ) : null}

                {/* If it hasn't happened: a detour that rejoins the road. */}
                {checks.length ? (
                  <>
                    <path
                      d={`M${ax},${ay} C${ax + 2},${low - 30} ${mid - 18},${low} ${mid},${low} C${mid + 18},${low} ${bx - 2},${low - 30} ${bx},${by}`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      strokeLinecap="round"
                    />
                    <circle cx={mid} cy={low} r={4} fill="#f59e0b" />
                    {checks.map((c, ci) => (
                      <text
                        key={c.id}
                        x={mid}
                        y={low + 26 + ci * 18}
                        textAnchor="middle"
                        className="fill-amber-800 text-[12px]"
                      >
                        {c.title.toLowerCase().includes(c.target.toLowerCase()) ? c.title : `${c.title} · ${c.target}`}
                      </text>
                    ))}
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-8 rounded-full bg-gradient-to-r from-[#051e36] via-[#0c5290] to-[#1a8fd4]" aria-hidden />
          The main path
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-[3px] border-[#0c5290] bg-white" aria-hidden />
          Each phase&apos;s milestone and its target day
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="28" height="10" aria-hidden>
            <path d="M2 5 H26" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
          </svg>
          If it hasn&apos;t happened: what we do, then back on the road
        </span>
        <span className="text-slate-500">Click a phase to see its moments in the table.</span>
      </div>
    </div>
  );
}
