import { redirect } from "next/navigation";

export default function AdminLeadMagnetsPage() {
  redirect("/admin/campaigns?tab=magnets");
}
