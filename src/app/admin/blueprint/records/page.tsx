import { redirect } from "next/navigation";

/** Records was replaced by Coaches → Launches (16 Nov). */
export default function AdminBlueprintRecordsPage() {
  redirect("/admin?view=launch");
}
