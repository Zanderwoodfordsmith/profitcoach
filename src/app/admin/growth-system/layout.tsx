import { StickyPageHeader } from "@/components/layout";

export default function GrowthSystemLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Growth system overview"
        description="Internal preview of the recommended coaching business journey. Linked from Academy → Archive links."
      />
      {children}
    </div>
  );
}
