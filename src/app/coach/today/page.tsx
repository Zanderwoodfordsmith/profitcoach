import { redirect } from "next/navigation";

/** Today is hidden from coaches while it's redesigned (admins have it under Tools and links). */
export default function CoachTodayPage() {
  redirect("/coach/conversations");
}
