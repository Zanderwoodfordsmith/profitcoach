import { RoadmapProjectUpdatesTab } from "@/components/admin/roadmap/RoadmapProjectPage";

export default async function AdminRoadmapProjectUpdatesPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <RoadmapProjectUpdatesTab name={decodeURIComponent(name)} />;
}
