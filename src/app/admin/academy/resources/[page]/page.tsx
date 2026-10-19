import { notFound } from "next/navigation";

import { ResourceReader } from "@/components/resources/ResourceReader";
import { loadResourcePage } from "@/lib/resources/loadLibrary";

export default async function AdminResourcePage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const loaded = await loadResourcePage(page);
  if (!loaded) notFound();

  return <ResourceReader slug={page} docs={loaded.docs} />;
}
