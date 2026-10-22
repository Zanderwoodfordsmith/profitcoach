import type { Metadata } from "next";
import { Suspense } from "react";
import DirectoryClient from "../DirectoryClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The first directory overview, kept for comparison. */
export default function DirectoryClassicPage() {
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
