import { RoadmapInitiativeOverview } from "@/components/admin/roadmap/RoadmapInitiatives";

export default async function AdminRoadmapInitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoadmapInitiativeOverview id={id} />;
}
