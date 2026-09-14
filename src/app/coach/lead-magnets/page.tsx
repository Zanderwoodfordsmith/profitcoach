import { redirect } from "next/navigation";

export default function CoachLeadMagnetsPage() {
  redirect("/coach/campaigns?tab=magnets");
}
