import { Suspense, type ReactNode } from "react";
import { SignatureAreaLayout } from "@/components/compass/SignatureAreaLayout";

export default function AdminSignatureLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <SignatureAreaLayout>{children}</SignatureAreaLayout>
    </Suspense>
  );
}
