"use client";

import { Suspense } from "react";
import { SearchPage } from "@/components/search/SearchPage";

export default function CoachSearchPage() {
  return (
    <Suspense
      fallback={
        <p className="px-1 py-8 text-sm text-slate-500">Loading search…</p>
      }
    >
      <SearchPage />
    </Suspense>
  );
}
