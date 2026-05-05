import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getPublicDirectoryCoachBySlug } from "@/lib/publicDirectoryCoach";
import { DirectoryLevelBadge } from "@/components/directory/DirectoryLevelBadge";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const coach = await getPublicDirectoryCoachBySlug(slug);
  if (!coach) {
    return { title: "Coach not found" };
  }
  return {
    title: coach.full_name
      ? `${coach.full_name} | Coach directory`
      : "Coach | Coach directory",
    description: coach.bio?.slice(0, 160) ?? undefined,
  };
}

export default async function DirectoryCoachPage({ params }: Props) {
  const { slug } = await params;
  const coach = await getPublicDirectoryCoachBySlug(slug);
  if (!coach) notFound();

  const matchUrl = `/landing/a?coach=${encodeURIComponent(coach.slug)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm text-slate-500">
        <Link href="/directory" className="font-medium text-sky-700 hover:underline">
          ← Directory
        </Link>
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative aspect-[21/9] w-full bg-slate-100 sm:aspect-[3/1]">
          {coach.avatar_url ? (
            <img
              src={coach.avatar_url}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No photo
            </div>
          )}
        </div>
        <DirectoryLevelBadge level={coach.directory_level} />
        <div className="space-y-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {coach.full_name ?? coach.slug}
            </h1>
            {coach.coach_business_name ? (
              <p className="mt-1 text-lg text-slate-600">
                {coach.coach_business_name}
              </p>
            ) : null}
            {coach.location ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {coach.location}
              </p>
            ) : null}
          </div>

          {coach.bio ? (
            <div className="space-y-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {coach.bio}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={matchUrl}
              className="inline-flex items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              Get started
            </Link>
            {coach.linkedin_url ? (
              <a
                href={coach.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                LinkedIn
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
