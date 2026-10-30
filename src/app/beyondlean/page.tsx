import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { beyondleanMode } from "@/lib/beyondlean/mode";
import { BeyondleanV5 } from "@/components/beyondlean/BeyondleanV5";
import { VersionSwitch } from "@/components/beyondlean/v5/parts";

export const metadata: Metadata = {
  title: "Paul Swift | Beyondlean Business Coaching",
  description:
    "Paul Swift spent 25 years fixing how work gets done at Airbus, in banking, energy and defence. Now he coaches owners of growing UK businesses.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ v?: string }> };

export default async function BeyondleanPage({ searchParams }: Props) {
  const { enabled, preview } = beyondleanMode();
  if (!enabled) notFound();
  const old = preview && (await searchParams).v === "old";
  return <BeyondleanV5 old={old} switcher={preview ? <VersionSwitch current={old ? "old" : "new"} /> : null} />;
}
