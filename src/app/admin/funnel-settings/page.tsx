import { redirect } from "next/navigation";

export default function AdminFunnelSettingsPage() {
  redirect("/admin/campaigns?tab=magnets");
}
