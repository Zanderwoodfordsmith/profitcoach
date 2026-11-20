import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { beyondleanMode, beyondleanRobots } from "@/lib/beyondlean/mode";
import { BeyondleanV5 } from "@/components/beyondlean/BeyondleanV5";

export const metadata: Metadata = {
  title: "Paul Swift | Beyondlean Business Coaching",
  description:
    "Paul Swift spent 25 years fixing how work gets done at Airbus, in banking, energy and defence. Now he coaches owners of growing UK businesses.",
  robots: beyondleanRobots,
};

export default function BeyondleanPage() {
  if (!beyondleanMode().enabled) notFound();
  return <BeyondleanV5 />;
}
