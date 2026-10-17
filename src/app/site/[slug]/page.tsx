import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CoachSitePage } from "@/components/coachSite/CoachSitePage";
import { coachSiteGraphics } from "@/lib/coachSite/graphics";
import { loadCoachSite } from "@/lib/coachSite/load";
import { coachSiteMode } from "@/lib/coachSite/mode";
import { parseVariants } from "@/lib/coachSite/variants";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const siteFor = cache(async (slug: string) => {
  const mode = coachSiteMode();
  if (!mode.enabled) return null;
  return loadCoachSite(slug, { approvedOnly: !mode.preview });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await siteFor(slug);
  if (!site) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: `${site.name} | Profit Coach`,
    description: site.mediumLine ?? site.intro ?? `${site.name}, Certified Profit Coach.`,
    // Not indexed until coach websites are released.
    robots: { index: false, follow: false },
  };
}

export default async function CoachWebsitePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const site = await siteFor(slug);
  if (!site) notFound();
  const [graphics, query] = await Promise.all([coachSiteGraphics(site), searchParams]);
  const { preview } = coachSiteMode();
  return (
    <CoachSitePage
      site={site}
      variants={parseVariants(query)}
      graphics={graphics}
      preview={preview}
      compareHref={`/site/${encodeURIComponent(site.slug)}/heroes`}
    />
  );
}
