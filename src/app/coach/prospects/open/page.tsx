"use client";

import { Suspense } from "react";
import { PoolPersonOpenGate } from "@/components/pool/PoolPersonOpenGate";

export default function PoolPersonOpenPage() {
  return (
    <Suspense
      fallback={<p className="px-1 py-6 text-sm text-slate-600">Opening…</p>}
    >
      <PoolPersonOpenGate />
    </Suspense>
  );
}
