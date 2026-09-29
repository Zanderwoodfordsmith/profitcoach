import { redirect } from "next/navigation";

/** Moved under Coaches → Blueprint. Keep this URL for bookmarks. */
export default async function AdminPracticeDetailRedirectPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const { coachId } = await params;
  redirect(`/admin/blueprint/records/${encodeURIComponent(coachId)}`);
}
