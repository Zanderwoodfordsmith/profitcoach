import { redirect } from "next/navigation";

/** Getting live is now a view on Coaches (Zander picked it on 28 Oct); old links land there. */
export default function AdminGettingLivePage() {
  redirect("/admin?view=getting-live");
}
