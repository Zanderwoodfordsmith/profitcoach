import { redirect } from "next/navigation";

/** Drafts now live on the coach's own page, Getting live tab. */
export default async function CoachDraftsRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/admin/coaches/${encodeURIComponent(slug)}?tab=getting-live&from=getting-live`);
}
