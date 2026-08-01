import { redirect } from "next/navigation";

/** Old `/simplified` hub URL → Classroom. */
export default function CoachAcademySimplifiedRedirectPage() {
  redirect("/coach/academy/classroom");
}
