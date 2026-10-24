import { Suspense } from "react";
import { InAppNotFound } from "@/components/notFound/InAppNotFound";

export default function AdminNotFound() {
  return (
    <Suspense>
      <InAppNotFound prefix="/admin" />
    </Suspense>
  );
}
