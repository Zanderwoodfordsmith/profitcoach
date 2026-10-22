import type { Metadata } from "next";
import { DirectoryFinder } from "@/components/directoryFinder/v1/DirectoryFinder";
import { COACH_OF_THE_MONTH_SLUG } from "@/lib/directoryOrder";
import { loadDirectoryCards } from "@/lib/directoryPage/list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The first map-and-portraits overview (22 Oct), kept for comparison. */
export default async function DirectoryV1Page() {
  const cards = await loadDirectoryCards();
  return <DirectoryFinder cards={cards} featuredSlug={COACH_OF_THE_MONTH_SLUG} initialArea={null} initialQuery="" />;
}
