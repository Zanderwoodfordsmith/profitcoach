import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { SupportTicketsPage } from "@/components/support/SupportTicketsPage";

export default function CoachSupportPage() {
  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-none"
      gapClass="gap-0"
      outerClassName="h-full min-h-0"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        <StickyPageHeader
          bleedInset="px-4 md:px-6"
          title="Support"
          description="Open a ticket to read the thread. A number stays on replies until you open them."
        />
      }
    >
      <SupportTicketsPage />
    </DashboardPageSection>
  );
}
