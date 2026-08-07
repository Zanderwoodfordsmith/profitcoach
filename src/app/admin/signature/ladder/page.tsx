import { redirect } from "next/navigation";

/** Ladder lives under Account settings. */
export default function AdminSignatureLadderRedirectPage() {
  redirect("/admin/account?tab=ladder");
}
