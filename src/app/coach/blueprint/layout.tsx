"use client";

import type { ReactNode } from "react";

import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";

export default function PracticeLayout({ children }: { children: ReactNode }) {
  return (
    <PracticeProvider>
      <PracticeShell>{children}</PracticeShell>
    </PracticeProvider>
  );
}
