import { ClassroomCatalogGrid } from "@/components/academy/ClassroomCatalogGrid";

const BASE = "/coach/academy/classroom";

export default async function CoachAcademyClassroomCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ cards?: string }>;
}) {
  const { cards } = await searchParams;
  return <ClassroomCatalogGrid basePath={BASE} cardsVersion={cards} />;
}
