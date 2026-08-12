import { redirect } from "next/navigation";

import { programmeJoinCheckoutHref } from "@/config/programmeJoin";

/**
 * Programme join: go straight to Stripe Checkout.
 * After pay → /welcome?session_id=… (create account + auto sign-in).
 */
export default function ProgramJoinPage() {
  redirect(programmeJoinCheckoutHref());
}
