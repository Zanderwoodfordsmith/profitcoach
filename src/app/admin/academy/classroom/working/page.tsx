import { redirect } from "next/navigation";

import { firstWorkingLesson } from "@/lib/academy/workingLessons";

export default function AdminWorkingLessonsIndexPage() {
  redirect(
    `/admin/academy/classroom/working/${encodeURIComponent(firstWorkingLesson().id)}`,
  );
}
