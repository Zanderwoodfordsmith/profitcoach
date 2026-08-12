import { redirect } from "next/navigation";

export default function CoachFunnelSettingsPage() {
  redirect("/coach/settings?tab=funnel");
}
