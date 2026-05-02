import { redirect } from "next/navigation";

/** Map lives under Community → Map tab; keep this URL for bookmarks. */
export default function CoachMapRedirectPage() {
  redirect("/coach/community?tab=map");
}
