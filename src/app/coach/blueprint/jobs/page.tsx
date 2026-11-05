import { Suspense } from "react";

import { JobsPage } from "@/components/jobs/JobsPage";

export default function BlueprintJobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsPage />
    </Suspense>
  );
}
