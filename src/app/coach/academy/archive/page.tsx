import { redirect } from "next/navigation";

/** Retired coach archive: old links land in the Classroom. */
export default function CoachAcademyArchiveRedirectPage() {
  redirect("/coach/academy/classroom");
}
