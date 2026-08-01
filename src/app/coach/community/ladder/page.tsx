import { redirect } from "next/navigation";

export default function CoachCommunityLadderRedirectPage() {
  redirect("/coach/settings?tab=ladder");
}
