import { Suspense } from "react";
import { MyActionsTab } from "@/components/compass/MyActionsTab";

function ActionsFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-slate-500">
      Loading actions…
    </div>
  );
}

export default function CoachSignatureActionsPage() {
  return (
    <Suspense fallback={<ActionsFallback />}>
      <MyActionsTab />
    </Suspense>
  );
}
