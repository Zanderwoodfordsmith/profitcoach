import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";

export default async function PublicBookCalendarPage({
  params,
}: {
  params: Promise<{ slug: string; calendarSlug: string }>;
}) {
  const { slug, calendarSlug } = await params;
  const clean = (slug ?? "").trim().toLowerCase();
  const cal = (calendarSlug ?? "").trim().toLowerCase() || "discovery";

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#061018] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[920px]">
        <StartApplyPanelNative
          variant="modal"
          enableLeadCapture={false}
          slug={clean || "unknown"}
          calendarSlug={cal}
        />
      </div>
    </div>
  );
}
