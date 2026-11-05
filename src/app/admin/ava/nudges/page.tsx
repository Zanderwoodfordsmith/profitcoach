import { redirect } from "next/navigation";

/** Nudges moved into Ava's top bar (5 Nov); old links land on the tab. */
export default function AdminAvaNudgesPage() {
  redirect("/admin/ava?tab=nudges");
}
