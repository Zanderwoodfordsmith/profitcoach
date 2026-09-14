import { redirect } from "next/navigation";

/** Pipeline is now the board view on Prospects. */
export default function CoachPipelineRedirect() {
  redirect("/coach/prospects?view=board");
}
