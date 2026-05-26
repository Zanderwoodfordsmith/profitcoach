import { redirect } from "next/navigation";
import { profitCoachFunnelBaseUrl } from "@/lib/theProfitCoachMirrorHtml";

export default function Home() {
  const funnelHome = profitCoachFunnelBaseUrl();
  if (funnelHome) {
    redirect(funnelHome);
  }
  redirect("/login");
}
