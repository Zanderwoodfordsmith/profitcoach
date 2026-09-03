import { redirect } from "next/navigation";

/** Vertical lead flow retired — use Classroom → System. */
export default function AdminLeadFlowRedirectPage() {
  redirect("/admin/academy/classroom/system");
}
