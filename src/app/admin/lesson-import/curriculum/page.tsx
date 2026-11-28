import { CurriculumPlanBoard } from "@/components/academy/CurriculumPlanBoard";
import { loadCurriculumBoard } from "@/lib/academy/curriculumPlanLoad";
import { loadNewCurriculumPlan } from "@/lib/academy/newCurriculumPlanLoad";

/** Plan rows change from the board itself. */
export const dynamic = "force-dynamic";

export default async function AdminLessonImportCurriculumPage() {
  const [board, newPlan] = await Promise.all([loadCurriculumBoard(), loadNewCurriculumPlan()]);
  // The board renders the page header so its column header can stick under it.
  return <CurriculumPlanBoard board={board} newPlan={newPlan} />;
}
