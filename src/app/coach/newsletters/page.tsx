"use client";

import { Suspense } from "react";
import { NewsletterPage } from "@/components/admin/linkedin/NewsletterPage";

export default function CoachNewsletterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <NewsletterPage />
    </Suspense>
  );
}
