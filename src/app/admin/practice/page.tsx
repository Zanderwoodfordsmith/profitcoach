import { redirect } from "next/navigation";

/** Moved under Coaches → Blueprint. Keep this URL for bookmarks. */
export default function AdminPracticeRedirectPage() {
  redirect("/admin/blueprint/records");
}
