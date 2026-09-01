import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { SupportTicketsPage } from "@/components/support/SupportTicketsPage";

export default function CoachSupportPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-3xl"
      header={
        <StickyPageHeader
          title="Support"
          description="Raise a ticket and we'll get back to you. Track open conversations below."
        />
      }
    >
      <SupportTicketsPage />
    </DashboardPageSection>
  );
}
