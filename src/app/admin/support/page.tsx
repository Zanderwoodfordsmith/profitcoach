import { Suspense } from "react";
import { AdminSupportPage } from "@/components/support/AdminSupportPage";

export default function AdminSupportRoutePage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-slate-600">Loading…</p>}>
      <AdminSupportPage />
    </Suspense>
  );
}
