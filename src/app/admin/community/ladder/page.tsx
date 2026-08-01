import { redirect } from "next/navigation";

export default function AdminCommunityLadderRedirectPage() {
  redirect("/admin/account?tab=ladder");
}
