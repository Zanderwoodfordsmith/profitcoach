import { Suspense } from "react";
import DirectoryClient from "./DirectoryClient";

export default function DirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-16 text-center text-sm text-slate-600">
          Loading directory…
        </div>
      }
    >
      <DirectoryClient />
    </Suspense>
  );
}
