import "server-only";

import type { InlineGraphic } from "@/lib/coachSite/graphics";
import { bossWheelBanded, EXAMPLE_AREA_SCORES } from "@/lib/printPack/wheel.js";

type Graphic = { viewBox: string; body: string };

/** The BOSS Wheel with example scores, for the Score section of a coach page. */
export function exampleWheel(): InlineGraphic {
  // The print pack is plain JS; its default `scores = null` reads as type null to TypeScript.
  const draw = bossWheelBanded as (o: { scores?: number[] | null; idp: string }) => Graphic;
  const g = draw({ scores: EXAMPLE_AREA_SCORES, idp: "dpw" });
  return { viewBox: g.viewBox, body: g.body, title: "BOSS Wheel with example scores" };
}
