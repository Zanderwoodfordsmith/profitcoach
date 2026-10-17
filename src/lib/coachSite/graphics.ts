import "server-only";

import { svgDoc } from "@/lib/printPack/brand.js";
import { svgForInline } from "@/lib/printPack/browserExport";
import { makeCoach } from "@/lib/printPack/coach.js";
import { oldNewLandscape } from "@/lib/printPack/oldnew.js";
import { playbookMap } from "@/lib/printPack/playbooks.js";
import { scorecardSheet } from "@/lib/printPack/scorecard.js";
import { bossWheelBanded, EXAMPLE_AREA_SCORES } from "@/lib/printPack/wheel.js";
import type { CoachSite } from "./types";

/** An SVG from the print pack, split so a page can draw it inline with its own <svg>. */
export type InlineGraphic = { viewBox: string; body: string; title: string };

/** A whole SVG file, for downloads (keeps the font import so it renders on its own). */
export type GraphicFile = { svg: string; title: string; filename: string };

export type CoachSiteGraphics = {
  wheel: InlineGraphic;
  playbooks: InlineGraphic;
  oldNew: InlineGraphic;
  scorecard: InlineGraphic;
  /** The A4 scorecard with the coach's QR, for the opt-in download. */
  scorecardFile: GraphicFile;
  /** The 50 playbooks map, for the opt-in download. */
  playbooksFile: GraphicFile;
};

type Graphic = { viewBox: string; body: string; w: number; h: number };

function inline(svg: string, title: string): InlineGraphic {
  const clean = svgForInline(svg);
  const viewBox = clean.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 100 100";
  const body = clean
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "");
  return { viewBox, body, title };
}

function fromGraphic(g: Graphic, title: string): InlineGraphic {
  return { viewBox: g.viewBox, body: g.body, title };
}

/** Every id prefix here is unique on the page, so the inline SVGs never share gradient or clip ids. */
export async function coachSiteGraphics(site: CoachSite): Promise<CoachSiteGraphics> {
  // The printed scorecard sends people to the landing page first, like the coach's social posts.
  const coach = await makeCoach(
    { name: site.name, business: "The Profit Coach", slug: site.slug, avatarDataUri: null },
    { link: "score" }
  );

  // The print pack is plain JS; its default `scores = null` reads as type null to TypeScript.
  const drawWheel = bossWheelBanded as (o: { scores?: number[] | null; idp: string }) => Graphic;
  const wheel = drawWheel({ scores: EXAMPLE_AREA_SCORES, idp: "csw" });
  const playbooks = playbookMap({ idp: "csp", style: "banded" }) as Graphic;
  const playbooksDownload = playbookMap({ idp: "pmd", style: "banded" }) as Graphic;
  const scorecardSvg = scorecardSheet({ idp: "css", coach }) as string;
  const scorecardDownload = scorecardSheet({ idp: "scd", coach }) as string;

  return {
    wheel: fromGraphic(wheel, "BOSS Wheel with example scores"),
    playbooks: fromGraphic(playbooks, "The 50 playbooks of the Profit System, by area and level"),
    oldNew: inline(oldNewLandscape({ idp: "cso" }) as string, "The old way and the new way"),
    scorecard: inline(scorecardSvg, `BOSS Scorecard with ${site.firstName}'s QR code`),
    scorecardFile: {
      svg: scorecardDownload,
      title: "BOSS Scorecard",
      filename: `BOSS Scorecard - ${site.name}`,
    },
    playbooksFile: {
      svg: svgDoc({
        w: playbooksDownload.w,
        h: playbooksDownload.h,
        viewBox: playbooksDownload.viewBox,
        title: "The 50 playbooks",
        body: playbooksDownload.body,
      }),
      title: "The 50 playbooks",
      filename: "The 50 playbooks - Profit System",
    },
  };
}
