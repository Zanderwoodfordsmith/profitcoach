"use client";

import type { ReactNode } from "react";
import { CoachClientHubGate } from "@/components/coach/CoachClientHubGate";

export default function CoachContactLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <CoachClientHubGate>{children}</CoachClientHubGate>;
}
