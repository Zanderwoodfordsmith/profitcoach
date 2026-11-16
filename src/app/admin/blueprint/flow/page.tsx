import { redirect } from "next/navigation";

/** The flow map lives in Admin → Ava → Flow. */
export default function AdminBlueprintFlowPage() {
  redirect("/admin/ava?tab=flow");
}
