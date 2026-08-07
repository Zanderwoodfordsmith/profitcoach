import { redirect } from "next/navigation";

/** `/book/[slug]` → Discovery calendar. */
export default async function PublicBookIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clean = (slug ?? "").trim().toLowerCase() || "unknown";
  redirect(`/book/${encodeURIComponent(clean)}/discovery`);
}
