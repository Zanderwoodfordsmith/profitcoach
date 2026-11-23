import { redirect } from "next/navigation";

/** The Getting live view was removed from Coaches (21 Nov); old links land on Launches. */
export default function AdminGettingLivePage() {
  redirect("/admin?view=launch");
}
