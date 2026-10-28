"use client";

import { useState } from "react";
import {
  Briefcase,
  Compass,
  Flag,
  Globe,
  GraduationCap,
  Handshake,
  Heart,
  Layers,
  Megaphone,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { INITIATIVE_COLORS, INITIATIVE_ICONS, type RoadmapInitiative } from "@/lib/roadmap/projectTypes";
import { useDismiss } from "./roadmapUi";

/** An initiative's icon in a soft circle of its colour, like Linear's. */

const ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  "trending-up": TrendingUp,
  target: Target,
  sparkles: Sparkles,
  heart: Heart,
  users: Users,
  handshake: Handshake,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  megaphone: Megaphone,
  globe: Globe,
  compass: Compass,
  flag: Flag,
  shield: Shield,
  wrench: Wrench,
  zap: Zap,
  star: Star,
  layers: Layers,
};

const TONE: Record<string, { circle: string; swatch: string }> = {
  sky: { circle: "bg-sky-100 text-sky-700", swatch: "bg-sky-500" },
  violet: { circle: "bg-violet-100 text-violet-700", swatch: "bg-violet-500" },
  emerald: { circle: "bg-emerald-100 text-emerald-700", swatch: "bg-emerald-500" },
  amber: { circle: "bg-amber-100 text-amber-700", swatch: "bg-amber-400" },
  rose: { circle: "bg-rose-100 text-rose-700", swatch: "bg-rose-500" },
  orange: { circle: "bg-orange-100 text-orange-700", swatch: "bg-orange-500" },
  teal: { circle: "bg-teal-100 text-teal-700", swatch: "bg-teal-500" },
  slate: { circle: "bg-slate-100 text-slate-600", swatch: "bg-slate-500" },
};

export function InitiativeIcon({
  initiative,
  size = "md",
}: {
  initiative: Pick<RoadmapInitiative, "icon" | "color">;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICONS[initiative.icon ?? ""] ?? Flag;
  const tone = TONE[initiative.color ?? ""] ?? TONE.slate;
  const box = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-5 w-5" : "h-8 w-8";
  const glyph = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${box} ${tone.circle}`} aria-hidden>
      <Icon className={glyph} />
    </span>
  );
}

/** Click the icon to pick another icon or colour. */
export function InitiativeIconPicker({
  initiative,
  onChange,
}: {
  initiative: Pick<RoadmapInitiative, "icon" | "color" | "name">;
  onChange: (patch: { icon?: string; color?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const color = initiative.color ?? "slate";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Change ${initiative.name}'s icon`}
        title="Change the icon"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full transition hover:ring-4 hover:ring-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
      >
        <InitiativeIcon initiative={initiative} size="lg" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-6 gap-1.5">
            {INITIATIVE_ICONS.map((key) => {
              const Icon = ICONS[key];
              const picked = initiative.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key.replace("-", " ")}
                  aria-pressed={picked}
                  onClick={() => onChange({ icon: key })}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    picked ? TONE[color].circle : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            {INITIATIVE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => onChange({ color: c })}
                className={`h-5 w-5 rounded-full ${TONE[c].swatch} ${color === c ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
