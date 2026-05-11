import { Suspense } from "react";
import AttendeesClient from "./AttendeesClient";

export const metadata = {
  title: "Conference attendees | Profit Coach",
  description:
    "See who is coming to the conference — photos, bios, and links to full profiles.",
};

export default function AttendeesPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-16 text-center text-sm text-slate-600">
          Loading attendees…
        </div>
      }
    >
      <AttendeesClient />
    </Suspense>
  );
}
