import { redirect } from "next/navigation";

/** Moved into Classroom → System for admin and members. */
export default function AdminHorizontalLeadFlowRedirectPage() {
  redirect("/admin/academy/classroom/system");
}
