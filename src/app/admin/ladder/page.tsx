import { redirect } from "next/navigation";

export default function AdminLadderRedirectPage() {
  redirect("/admin/account?tab=ladder");
}
