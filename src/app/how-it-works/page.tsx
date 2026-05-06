import type { Metadata } from "next";
import { HowItWorksContent } from "./HowItWorksContent";

export const metadata: Metadata = {
  title: "How It Works — The Profit Coach",
  description:
    "The Profit System: BOSS Diagnostic, three pillars, nine business modules, five owner levels, and one-to-one coaching — step by step.",
};

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}
