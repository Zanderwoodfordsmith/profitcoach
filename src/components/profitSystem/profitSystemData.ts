import type { ComponentType, CSSProperties } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarCheck2,
  Compass,
  Cog,
  Eye,
  Gauge,
  Gem,
  Megaphone,
  Network,
  Target,
  Users,
} from "lucide-react";

import { AREAS } from "@/lib/bossData";
import { AREA_TRANSFORMATIONS, PILLAR_TAGLINES } from "@/lib/profitSystemCopy";

/**
 * Shared data for the Profit System graphics components. Names come straight
 * from bossData (the live model), so the graphics can never drift from the
 * assessments and playbooks.
 */

export type PillarKey = "vision" | "velocity" | "value";

export type DiagramIcon = ComponentType<{
  className?: string;
  style?: CSSProperties;
}>;

export const PILLARS: Record<
  PillarKey,
  {
    label: string;
    tagline: string;
    color: string;
    colorDark: string;
    icon: DiagramIcon;
  }
> = {
  vision: {
    label: "Vision",
    tagline: PILLAR_TAGLINES.vision,
    color: "#0c5290",
    colorDark: "#093f70",
    icon: Eye,
  },
  velocity: {
    label: "Velocity",
    tagline: PILLAR_TAGLINES.velocity,
    color: "#42a1ee",
    colorDark: "#2b86d3",
    icon: Gauge,
  },
  value: {
    label: "Value",
    tagline: PILLAR_TAGLINES.value,
    color: "#1ca0c2",
    colorDark: "#14829f",
    icon: Gem,
  },
};

export type Accelerator = {
  /** 1-9, reading order through the journey. */
  step: number;
  name: string;
  pillar: PillarKey;
  icon: DiagramIcon;
  /** Owner-language transformation, "from" side. */
  from: string;
  /** Owner-language transformation, "to" side. */
  to: string;
};

const AREA_ICONS: Record<number, DiagramIcon> = {
  1: Compass,
  2: Target,
  3: CalendarCheck2,
  4: Banknote,
  5: Megaphone,
  6: Cog,
  7: BarChart3,
  8: Network,
  9: Users,
};

// AREA_TRANSFORMATIONS lives in @/lib/profitSystemCopy so the print pack shares it.

export const ACCELERATORS: Accelerator[] = AREAS.filter(
  (a) => a.pillar === "vision" || a.pillar === "velocity" || a.pillar === "value"
).map((a) => ({
  step: a.id,
  name: a.name,
  pillar: a.pillar as PillarKey,
  icon: AREA_ICONS[a.id] ?? Compass,
  from: AREA_TRANSFORMATIONS[a.id]?.from ?? "",
  to: AREA_TRANSFORMATIONS[a.id]?.to ?? "",
}));

export function acceleratorsForPillar(pillar: PillarKey): Accelerator[] {
  return ACCELERATORS.filter((a) => a.pillar === pillar);
}

export const OWNER_LEVELS: {
  id: number;
  name: string;
  description: string;
}[] = [
  {
    id: 1,
    name: "Overwhelm",
    description:
      "Not knowing what to do next. Too many fires — it's hard to run even day-to-day operations.",
  },
  {
    id: 2,
    name: "Overworked",
    description:
      "Exhausted from micromanaging because the team isn't yet trained or systemised.",
  },
  {
    id: 3,
    name: "Organised",
    description:
      "Processes and training are in place so things can run without you — at least short-term.",
  },
  {
    id: 4,
    name: "Overseer",
    description:
      "You're managing overall performance and working on the business, not only in it.",
  },
  {
    id: 5,
    name: "Owner",
    description:
      "Leadership runs the operation; you steer with minimal day-to-day involvement.",
  },
];

/** Pointy-top hexagon, used across the Profit System graphics. */
export const HEX_CLIP_PATH =
  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

/** Top facet of the bevelled ("isometric") hexagon. */
export const HEX_TOP_FACET_CLIP_PATH =
  "polygon(50% 0%, 100% 25%, 50% 50%, 0% 25%)";

/** Foundation area (Owner Performance) — the 10th icon in the set. */
export const FOUNDATION = {
  name: "Owner Performance",
  icon: Activity as DiagramIcon,
  color: "#334155",
};

/** Card/hexagon tones for the element kit (violet from the reference sheet). */
export const PS_TONES = {
  navy: { base: "#0c5290", dark: "#093f70", label: "Navy" },
  blue: { base: "#42a1ee", dark: "#2b86d3", label: "Blue" },
  teal: { base: "#1ca0c2", dark: "#14829f", label: "Teal" },
  violet: { base: "#8b5cf6", dark: "#7444e0", label: "Violet" },
  ink: { base: "#1e293b", dark: "#0f172a", label: "Ink" },
} as const;
export type PsTone = keyof typeof PS_TONES;

/** All ten areas (foundation + nine accelerators) for the icon set. */
export const AREA_ICON_SET: {
  id: number;
  name: string;
  icon: DiagramIcon;
  color: string;
}[] = [
  { id: 0, name: FOUNDATION.name, icon: FOUNDATION.icon, color: FOUNDATION.color },
  ...ACCELERATORS.map((a) => ({
    id: a.step,
    name: a.name,
    icon: a.icon,
    color: PILLARS[a.pillar].color,
  })),
];
