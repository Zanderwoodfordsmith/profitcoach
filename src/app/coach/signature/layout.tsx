import { Suspense, type ReactNode } from "react";
import { CompassAreaLayout } from "@/components/compass/CompassAreaLayout";

export default function CoachSignatureLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={<p className="text-sm text-slate-600">Loading…</p>}
    >
      <CompassAreaLayout>{children}</CompassAreaLayout>
    </Suspense>
  );
}
