import { redirect } from "next/navigation";

/** Launches is now the Launch view on All coaches (21 Nov); old links land there. */
export default function AdminCoachesBlueprintPage() {
  redirect("/admin?view=launch");
}
