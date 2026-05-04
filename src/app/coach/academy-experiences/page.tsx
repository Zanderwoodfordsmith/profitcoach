import { redirect } from "next/navigation";

/** Old URL — programmes now live under Current → Academy. */
export default function CoachAcademyExperiencesRedirectPage() {
  redirect("/coach/academy/programs");
}
