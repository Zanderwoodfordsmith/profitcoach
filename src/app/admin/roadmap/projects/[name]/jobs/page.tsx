import { RoadmapProjectJobsTab } from "@/components/admin/roadmap/RoadmapProjectPage";

export default async function AdminRoadmapProjectJobsPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <RoadmapProjectJobsTab name={decodeURIComponent(name)} />;
}
