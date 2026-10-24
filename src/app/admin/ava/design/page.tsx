import { redirect } from "next/navigation";

// The design options now live in Ava's Design tab.
export default function AvaDesignPage() {
  redirect("/admin/ava?tab=design");
}
