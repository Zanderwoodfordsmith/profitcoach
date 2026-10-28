import { redirect } from "next/navigation";

/** Updates live on the project's page now (28 Oct). */
export default async function AdminRoadmapProjectUpdatesPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  redirect(`/admin/roadmap/projects/${name}`);
}
