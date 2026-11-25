"use client";

import { Suspense } from "react";
import { NewsletterPage } from "@/components/admin/linkedin/NewsletterPage";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";

export default function AdminNewsletterIssuesPage() {
  useRequireAdminRole("/coach/newsletters");
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <NewsletterPage />
    </Suspense>
  );
}
