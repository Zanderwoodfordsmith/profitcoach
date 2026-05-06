import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ProfitCoachTopMenu />
      {children}
    </div>
  );
}
