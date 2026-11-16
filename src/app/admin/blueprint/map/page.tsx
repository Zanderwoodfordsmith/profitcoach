"use client";

import { AdminBlueprintMap } from "@/components/admin/AdminBlueprintMap";

export default function AdminBlueprintMapPage() {
  // The Blueprint frame clips its content, so the page scrolls itself (like Flow map).
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
        <AdminBlueprintMap />
      </div>
    </div>
  );
}
