import { redirect } from "next/navigation";

/** Old admin `/programs` archive → `/archive`. */
export default function AdminAcademyProgramsRedirectPage() {
  redirect("/admin/academy/archive");
}
