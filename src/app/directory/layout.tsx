import { Figtree } from "next/font/google";
import { SiteFooter, SiteNav } from "@/components/marketing/SiteNav";

/** Same face as the static site and the BCA website. */
const figtree = Figtree({ subsets: ["latin"], display: "swap" });

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
