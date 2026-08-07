import { redirect } from "next/navigation";

/** Site tools now live at the top of Admin → Links. */
export default function AdminSiteToolsPage() {
  redirect("/admin/links");
}
