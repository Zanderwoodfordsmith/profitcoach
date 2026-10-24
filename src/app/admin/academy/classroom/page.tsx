import { ClassroomCatalogGrid } from "@/components/academy/ClassroomCatalogGrid";

const BASE = "/admin/academy/classroom";

export default async function AdminAcademyClassroomCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ cards?: string }>;
}) {
  const { cards } = await searchParams;
  return <ClassroomCatalogGrid basePath={BASE} cardsVersion={cards} />;
}
