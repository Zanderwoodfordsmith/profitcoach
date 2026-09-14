import { redirect } from "next/navigation";

export default function CoachFunnelSettingsPage() {
  redirect("/coach/campaigns?tab=magnets");
}
