import { RoadmapInitiativeUpdates } from "@/components/admin/roadmap/RoadmapInitiatives";

export default async function AdminRoadmapInitiativeUpdatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoadmapInitiativeUpdates id={id} />;
}
