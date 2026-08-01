import { redirect } from "next/navigation";

/** Ladder lives under Account settings. */
export default function CoachSignatureLadderRedirectPage() {
  redirect("/coach/settings?tab=ladder");
}
