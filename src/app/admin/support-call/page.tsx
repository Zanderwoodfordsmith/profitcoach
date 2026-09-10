import { redirect } from "next/navigation";

/** Old dedicated URL — support-call settings now live under Support → Settings. */
export default function AdminSupportCallRedirectPage() {
  redirect("/admin/support?tab=settings");
}
