import { redirect } from "next/navigation";

/** Old URL: programmes now live in the Classroom. */
export default function CoachAcademyExperiencesRedirectPage() {
  redirect("/coach/academy/classroom");
}
