import { RoadmapProjectOverview } from "@/components/admin/roadmap/RoadmapProjectPage";

export default async function AdminRoadmapProjectPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <RoadmapProjectOverview name={decodeURIComponent(name)} />;
}
