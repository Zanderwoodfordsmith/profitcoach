import { StickyPageHeader } from "@/components/layout";
import { GrowthSystemTabs } from "@/components/academy/GrowthSystemTabs";

export default function GrowthSystemLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Growth System"
        description="Internal preview of the recommended coaching business journey."
        tabs={<GrowthSystemTabs />}
      />
      {children}
    </div>
  );
}
