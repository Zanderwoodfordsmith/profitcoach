import { CurriculumPlanBoard } from "@/components/academy/CurriculumPlanBoard";
import { loadCurriculumBoard } from "@/lib/academy/curriculumPlanLoad";

/** Plan rows change from the board itself. */
export const dynamic = "force-dynamic";

export default async function AdminLessonImportCurriculumPage() {
  const board = await loadCurriculumBoard();
  // The board renders the page header so its column header can stick under it.
  return <CurriculumPlanBoard board={board} />;
}
