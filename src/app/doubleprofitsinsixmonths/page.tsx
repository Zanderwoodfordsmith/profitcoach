import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoubleProfitsLanding } from "@/components/marketing/DoubleProfitsLanding";
import { getDoubleProfitsCoach } from "@/lib/getDoubleProfitsCoach";

type Props = {
  searchParams: Promise<{ coach?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { coach: coachParam } = await searchParams;
  const coach = await getDoubleProfitsCoach(coachParam ?? "pam");

  return {
    title: coach
      ? `${coach.copy.headline} | Profit Coach`
      : "Double your profits within 6 months | Profit Coach",
    description: coach?.copy.intro,
  };
}

export default async function DoubleProfitsInSixMonthsPage({ searchParams }: Props) {
  const { coach: coachParam } = await searchParams;
  const coach = await getDoubleProfitsCoach(coachParam ?? "pam");

  if (!coach) notFound();

  return <DoubleProfitsLanding coach={coach} />;
}
