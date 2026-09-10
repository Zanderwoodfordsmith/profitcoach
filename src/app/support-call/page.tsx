import { redirect } from "next/navigation";

/** Old combined picker URL — send to Zander’s page. */
export default function SupportCallRedirectPage() {
  redirect("/support-call-zander");
}
