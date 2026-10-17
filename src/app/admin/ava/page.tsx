"use client";

import { Suspense } from "react";

import { AvaAdmin } from "@/components/admin/ava/AvaAdmin";

export default function AdminAvaPage() {
  return (
    <Suspense fallback={<p className="py-10 text-sm text-slate-500">Loading Ava…</p>}>
      <AvaAdmin />
    </Suspense>
  );
}
