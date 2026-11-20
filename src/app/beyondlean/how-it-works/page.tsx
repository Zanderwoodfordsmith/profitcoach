import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HowPage } from "@/components/beyondlean/v5/HowPage";
import { beyondleanMode, beyondleanRobots } from "@/lib/beyondlean/mode";

export const metadata: Metadata = {
  title: "How it works | Paul Swift, Beyondlean",
  description:
    "Score your business, find the one thing holding it back on a Constraint Call, then fix what matters most with a 90-day plan worked through side by side.",
  robots: beyondleanRobots,
};

export default function HowItWorksPage() {
  if (!beyondleanMode().enabled) notFound();
  return <HowPage />;
}
