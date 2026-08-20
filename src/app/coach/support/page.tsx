import { StickyPageHeader } from "@/components/layout";
import { SupportTicketsPage } from "@/components/support/SupportTicketsPage";

export default function CoachSupportPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <StickyPageHeader
        title="Support"
        description="Raise a ticket and we'll get back to you. Track open conversations below."
      />
      <SupportTicketsPage />
    </div>
  );
}
