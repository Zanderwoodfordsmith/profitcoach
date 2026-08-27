import { redirect } from "next/navigation";

/** Coaching AI prompt now lives under Brand → Core brain → Skills. */
export default function AdminSettingsAICoachPage() {
  redirect("/admin/brand?tab=brain&brainTab=skills&open=coaching_ai");
}
