import { Suspense } from "react";
import { InAppNotFound } from "@/components/notFound/InAppNotFound";

export default function CoachNotFound() {
  return (
    <Suspense>
      <InAppNotFound prefix="/coach" />
    </Suspense>
  );
}
