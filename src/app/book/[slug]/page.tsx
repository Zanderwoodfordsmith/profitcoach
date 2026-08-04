import { PublicBookClient } from "@/components/booking/PublicBookClient";

export default async function PublicBookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clean = (slug ?? "").trim().toLowerCase();

  return (
    <div className="app-canvas-bg min-h-screen px-4 py-10 sm:px-6">
      <PublicBookClient slug={clean || "unknown"} />
    </div>
  );
}
