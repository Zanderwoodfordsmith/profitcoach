"use client";

import type { ReactNode } from "react";

import { BlueprintCoachPreview } from "@/components/admin/BlueprintCoachPreview";

export default function AdminBlueprintCoachLayout({ children }: { children: ReactNode }) {
  return <BlueprintCoachPreview>{children}</BlueprintCoachPreview>;
}
