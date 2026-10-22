import type { Metadata } from "next";
import { cache } from "react";
import { CoachProfile } from "@/components/directoryProfile/CoachProfile";
import { exampleWheel } from "@/lib/directoryPage/wheel";
import { loadDirectoryCoach } from "@/lib/directoryPage/load";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const coachFor = cache(loadDirectoryCoach);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = (await coachFor(slug))?.view;
  // Unlisted pages exist for their coach only; never describe them publicly.
  if (!view?.listed) return { title: "Coach | The Profit Coach", robots: { index: false, follow: false } };
  const description = view.summary ?? view.bio?.slice(0, 160) ?? `${view.name}, Profit Coach.`;
  return {
    title: `${view.name} | The Profit Coach`,
    description,
    openGraph: {
      title: view.name,
      description,
      images: view.avatarUrl ? [{ url: view.avatarUrl }] : undefined,
    },
  };
}

export default async function DirectoryCoachPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const view = (await coachFor(slug))?.view ?? null;
  return (
    <CoachProfile
      // A fresh page per coach, so the admin switcher never carries one coach's edits to the next.
      key={slug}
      slug={slug.trim().toLowerCase()}
      initial={view?.listed ? view : null}
      wheel={exampleWheel()}
      forceLive={query.view === "live"}
    />
  );
}
