import { redirect } from "next/navigation";

/** Old admin `/simplified` hub URL → Classroom. */
export default function AdminAcademySimplifiedRedirectPage() {
  redirect("/admin/academy/classroom");
}
