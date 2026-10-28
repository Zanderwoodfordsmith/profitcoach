import { RoadmapInitiativeProjects } from "@/components/admin/roadmap/RoadmapInitiatives";

export default async function AdminRoadmapInitiativeProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoadmapInitiativeProjects id={id} />;
}
