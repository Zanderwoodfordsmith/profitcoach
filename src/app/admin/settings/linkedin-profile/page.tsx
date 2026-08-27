import { redirect } from "next/navigation";

/** LinkedIn Optimizer prompt now lives under Brand → Core brain → Skills. */
export default function AdminLinkedInOptimizerPromptPage() {
  redirect("/admin/brand?tab=brain&brainTab=skills&open=linkedin_profile");
}
