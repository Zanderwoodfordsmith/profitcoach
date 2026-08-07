import { redirect } from "next/navigation";

/** Import moved to Admin sidebar — keep old Classroom tab URL working. */
export default function AdminAcademyImportStatusRedirect() {
  redirect("/admin/lesson-import");
}
