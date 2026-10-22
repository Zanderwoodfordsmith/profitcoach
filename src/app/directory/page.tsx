import type { Metadata } from "next";
import { DirectoryFinder } from "@/components/directoryFinder/DirectoryFinder";
import { COACH_OF_THE_MONTH_SLUG } from "@/lib/directoryOrder";
import { loadDirectoryCards } from "@/lib/directoryPage/list";

// Listing changes (a coach going live or hidden) show at once.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find your Profit Coach | The Profit Coach",
  description:
    "Every Profit Coach works from the same BOSS Score and the same 50 playbooks. Find one near you.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function DirectoryPage({ searchParams }: Props) {
  const [query, cards] = await Promise.all([searchParams, loadDirectoryCards()]);
  const area = one(query.area);
  const industry = one(query.industry).slice(0, 40);
  return (
    <DirectoryFinder
      cards={cards}
      featuredSlug={COACH_OF_THE_MONTH_SLUG}
      initialArea={/^[a-z-]{2,30}$/.test(area) ? area : null}
      initialIndustry={industry || null}
      initialQuery={one(query.q).slice(0, 80)}
    />
  );
}
