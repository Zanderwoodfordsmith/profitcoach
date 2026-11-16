import { redirect } from "next/navigation";

/** A coach's record now opens their Blueprint in the coach view (16 Nov). */
export default async function AdminBlueprintRecordPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const { coachId } = await params;
  redirect(`/admin/blueprint/coach?coach=${encodeURIComponent(coachId)}`);
}
