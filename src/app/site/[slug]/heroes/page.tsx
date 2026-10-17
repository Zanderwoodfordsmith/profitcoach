import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachSiteShell, Hero } from "@/components/coachSite/CoachSitePage";
import { coachSiteGraphics } from "@/lib/coachSite/graphics";
import { loadCoachSite } from "@/lib/coachSite/load";
import { coachSiteMode } from "@/lib/coachSite/mode";
import { SITE_VARIANTS } from "@/lib/coachSite/variants";

export const metadata: Metadata = {
  title: "Compare heroes",
  robots: { index: false, follow: false },
};

/** Preview only: every hero version for one coach, stacked, each linking to the full page. */
export default async function CompareHeroesPage({ params }: { params: Promise<{ slug: string }> }) {
  const mode = coachSiteMode();
  if (!mode.preview) notFound();
  const { slug } = await params;
  const site = await loadCoachSite(slug, { approvedOnly: false });
  if (!site) notFound();
  const graphics = await coachSiteGraphics(site);
  const base = `/site/${encodeURIComponent(site.slug)}`;
  return (
    <CoachSiteShell>
      {SITE_VARIANTS.hero.options.map((opt) => (
        <div key={opt.id}>
          <div className="cs-compare__label">
            <span>
              {opt.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {opt.note}</span>
            </span>
            <a href={`${base}?hero=${opt.id}`}>Open the full page with this hero</a>
          </div>
          <Hero site={site} hero={opt.id} graphics={graphics} />
        </div>
      ))}
    </CoachSiteShell>
  );
}
