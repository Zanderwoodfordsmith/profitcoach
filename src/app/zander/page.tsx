import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";

export const metadata = {
  title: "Book a call — Zander",
  description: "Pick a time for a discovery call.",
};

/** Vanity public book URL for Zander → Discovery calendar. */
export default function ZanderBookPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-[#061018] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[920px]">
        <StartApplyPanelNative
          variant="modal"
          enableLeadCapture={false}
          slug="zander"
          calendarSlug="discovery"
        />
      </div>
    </div>
  );
}
