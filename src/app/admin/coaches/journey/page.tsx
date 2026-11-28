import { Suspense } from "react";

import { CoachJourneyView } from "@/components/admin/coachJourney/CoachJourneyView";

/** Admin → Coaches → Journey: the coach journey map (Customer Activation Ramp, job 317). Admin only. */
export default function AdminCoachJourneyPage() {
  return (
    <Suspense fallback={null}>
      <CoachJourneyView />
    </Suspense>
  );
}
