import { redirect } from "next/navigation";

/** Pipeline is now the board view on Prospects. */
export default function AdminPipelineRedirect() {
  redirect("/admin/prospects?view=board");
}
