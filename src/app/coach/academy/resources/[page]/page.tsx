import { notFound } from "next/navigation";

import { ResourceReader } from "@/components/resources/ResourceReader";
import { findResourcePage } from "@/lib/resources/libraryData";

/** The slug only: the page's links and text load for a signed-in member (/api/academy/resources). */
export default async function CoachResourcePage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!findResourcePage(page)) notFound();

  return <ResourceReader slug={page} />;
}
