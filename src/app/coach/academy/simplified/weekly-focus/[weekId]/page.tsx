import { notFound } from "next/navigation";

import { WeeklyFocusView } from "@/components/academy/WeeklyFocusView";
import { findWeeklyFocusById, loadWeeklyFocusCatalog } from "@/lib/academy/weeklyFocus";

const BASE = "/coach/academy/simplified";

type Props = { params: Promise<{ weekId: string }> };

export default async function CoachWeeklyFocusWeekPage({ params }: Props) {
  const { weekId } = await params;
  const catalog = loadWeeklyFocusCatalog();
  if (!findWeeklyFocusById(catalog, weekId)) notFound();
  return <WeeklyFocusView basePath={BASE} weekId={weekId} />;
}
