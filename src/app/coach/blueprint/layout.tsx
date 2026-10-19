"use client";

import type { ReactNode } from "react";

import { StickyPageHeader } from "@/components/layout";
import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";

export default function PracticeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StickyPageHeader bleedInset="px-4 md:px-6" title="Blueprint" />
      <PracticeProvider>
        <PracticeShell embedded>{children}</PracticeShell>
      </PracticeProvider>
    </>
  );
}
