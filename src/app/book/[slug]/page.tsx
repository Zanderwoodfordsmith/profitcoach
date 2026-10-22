import { redirect } from "next/navigation";
import { cleanLeadParam } from "@/lib/booking/leadLink";

/** `/book/[slug]` → Discovery calendar (keeps a campaign's ?lead=). */
export default async function PublicBookIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lead?: string }>;
}) {
  const { slug } = await params;
  const lead = cleanLeadParam((await searchParams).lead);
  const clean = (slug ?? "").trim().toLowerCase() || "unknown";
  redirect(`/book/${encodeURIComponent(clean)}/discovery${lead ? `?lead=${lead}` : ""}`);
}
