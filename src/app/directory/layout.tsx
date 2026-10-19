import { figtree } from "@/fonts";
import { SiteFooter, SiteNav } from "@/components/marketing/SiteNav";

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${figtree.className} flex min-h-screen flex-col bg-[#F6F8FB] text-[#0D1F31]`}>
      <SiteNav current="/directory" />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
