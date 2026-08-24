import type { Metadata } from "next";

import { NineStepRoadmap } from "@/components/profitSystem/NineStepRoadmap";
import { OwnerLevelsDiagram } from "@/components/profitSystem/OwnerLevelsDiagram";
import { ProfitPillarsHexagons } from "@/components/profitSystem/ProfitPillarsHexagons";
import { ProgramPyramid } from "@/components/profitSystem/ProgramPyramid";

export const metadata: Metadata = {
  title: "Profit System graphics — component preview",
  robots: { index: false },
};

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-10 sm:px-10">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function ProfitSystemPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">
            Profit System graphics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Code-based replacements for the PNG graphics — recolorable,
            animatable, and driven by the live model in bossData. Refresh the
            page to replay the reveal animations.
          </p>
        </header>

        <Section kicker="Brief #1" title="The three pillars">
          <ProfitPillarsHexagons showAccelerators={false} />
        </Section>

        <Section
          kicker="Brief #2"
          title="The Profit System — pillars + nine accelerators"
        >
          <ProfitPillarsHexagons showAccelerators />
        </Section>

        <Section kicker="Brief #3" title="The programme pyramid">
          <ProgramPyramid />
        </Section>

        <Section kicker="Brief #4" title="The nine-step roadmap">
          <NineStepRoadmap />
        </Section>

        <Section kicker="Owner levels" title="The five levels of business owner">
          <OwnerLevelsDiagram />
        </Section>
      </div>
    </main>
  );
}
