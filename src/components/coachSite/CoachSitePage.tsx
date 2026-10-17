import { Figtree } from "next/font/google";
import { Suspense } from "react";
import { GOOGLE_FONTS_HREF } from "@/lib/printPack/brand.js";
import type { CoachSiteGraphics } from "@/lib/coachSite/graphics";
import type { CoachSite } from "@/lib/coachSite/types";
import type { SiteVariants } from "@/lib/coachSite/variants";
import { HeroDossier, HeroGap, HeroTerritory, HeroWheel } from "./Heroes";
import { Multiplier } from "./Multiplier";
import {
  About,
  CloseCall,
  CloseScore,
  Footer,
  GapLedger,
  Method,
  Nav,
  Offer,
  OldNew,
  OwnerWords,
  ProfitSystem,
  ProofBand,
  ProofLedger,
  ScoreBand,
  TakeItHome,
} from "./Sections";
import { VariantPanel } from "./VariantPanel";
import "./coachSite.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--cs-font",
  display: "swap",
});

export function CoachSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`cs-root ${figtree.variable}`} id="top">
      {/* The print-pack graphics (wheel, playbooks, scorecard) are set in Inter Tight and Inter. */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} precedence="default" />
      {children}
    </div>
  );
}

export function Hero({
  site,
  hero,
  graphics,
}: {
  site: CoachSite;
  hero: SiteVariants["hero"];
  graphics: CoachSiteGraphics;
}) {
  if (hero === "dossier") return <HeroDossier site={site} />;
  if (hero === "gap") return <HeroGap site={site} />;
  if (hero === "wheel") return <HeroWheel site={site} wheel={graphics.wheel} />;
  return <HeroTerritory site={site} />;
}

type Props = {
  site: CoachSite;
  variants: SiteVariants;
  graphics: CoachSiteGraphics;
  /** Local preview: design options, Blueprint gap markers, opt-ins that send nothing. */
  preview: boolean;
  compareHref: string;
};

export function CoachSitePage({ site, variants, graphics, preview, compareHref }: Props) {
  // Never show the example wheel twice in a row.
  const system = variants.hero === "wheel" ? "oldnew" : variants.system;
  return (
    <CoachSiteShell>
      <Nav site={site} />
      <main>
        <Hero site={site} hero={variants.hero} graphics={graphics} />
        <OwnerWords site={site} preview={preview} />
        {variants.hero !== "gap" ? <GapLedger site={site} /> : null}
        {system === "oldnew" ? (
          <OldNew site={site} graphics={graphics} />
        ) : (
          <ScoreBand site={site} graphics={graphics} />
        )}
        <Method site={site} preview={preview} />
        <ProfitSystem site={site} graphics={graphics} />
        <Multiplier firstName={site.firstName} />
        <Offer site={site} preview={preview} />
        {variants.proof === "band" ? (
          <ProofBand site={site} preview={preview} />
        ) : (
          <ProofLedger site={site} preview={preview} />
        )}
        <About site={site} preview={preview} />
        <TakeItHome site={site} graphics={graphics} preview={preview} />
        {variants.close === "call" ? <CloseCall site={site} /> : <CloseScore site={site} />}
      </main>
      <Footer site={site} />
      {preview ? (
        <Suspense fallback={null}>
          <VariantPanel variants={variants} missing={site.missing} compareHref={compareHref} />
        </Suspense>
      ) : null}
    </CoachSiteShell>
  );
}
