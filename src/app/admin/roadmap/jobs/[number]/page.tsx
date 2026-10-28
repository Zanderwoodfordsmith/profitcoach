import { notFound } from "next/navigation";
import { RoadmapJobsBoard } from "@/components/admin/roadmap/RoadmapJobsBoard";

/** A job's own page (Product → Jobs → one job), like Linear's issue page. */
export default async function AdminRoadmapJobPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return <RoadmapJobsBoard jobNumber={n} />;
}
