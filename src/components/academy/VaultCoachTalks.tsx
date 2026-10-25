import Link from "next/link";

import type { HubCourse } from "@/lib/academy/hubCatalog";
import { flattenSections } from "@/lib/academy/hubCatalog";

type Props = {
  course: HubCourse;
  basePath: string;
};

/** Who gave each talk, shown under the thumbnail (public/academy/vault/coach-talks/<lesson id>.jpg). */
const SPEAKERS: Record<string, { coach: string; credit: string }> = {
  "coach-talks-ashley-working-with-clients": { coach: "Ashley Maile", credit: "BCA Conference 2024" },
  "coach-talks-hilary-leadership-workshops": { coach: "Hilary McNair", credit: "Coach of the Month, October 2026" },
  "coach-talks-heidi-go-to-market": { coach: "Heidi Hattendorf", credit: "US Global Coach of the Year" },
  "coach-talks-derek-coaching-tools": { coach: "Derek Hollingdale", credit: "20 years coaching owners" },
  "coach-talks-pam-coaching-models": { coach: "Pam Featherstone", credit: "BCA Conference 2023" },
  "coach-talks-pam-world-class-coach": { coach: "Pam Featherstone", credit: "BCA Conference 2024" },
};

/** Single talks under the Vault courses: a lighter row of video thumbnails, not course cards. */
export function VaultCoachTalks({ course, basePath }: Props) {
  const talks = flattenSections(course.sections).flatMap((section) => section.lessons);
  if (talks.length === 0) return null;

  return (
    <section className="mt-14 pb-12" aria-labelledby="vault-coach-talks">
      <h2 id="vault-coach-talks" className="text-subhead font-semibold tracking-tight text-slate-900">
        {course.title}
      </h2>
      {course.description ? (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{course.description}</p>
      ) : null}
      <div className="mt-5 grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {talks.map((talk) => {
          const speaker = SPEAKERS[talk.id];
          return (
            <Link
              key={talk.id}
              href={`${basePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(talk.id)}`}
              className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-4"
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.12)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/academy/vault/coach-talks/${talk.id}.jpg`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <span
                  className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition duration-300 group-hover:bg-slate-900/20"
                  aria-hidden
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition duration-300 group-hover:opacity-100">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-[#0c5290]">
                      <path d="M8 5.5v13l10.5-6.5z" />
                    </svg>
                  </span>
                </span>
                {talk.duration ? (
                  <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-caption font-semibold tabular-nums text-white">
                    {talk.duration}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-ui font-semibold leading-snug text-slate-900 group-hover:text-[#0c5290]">
                {talk.title}
              </h3>
              {speaker ? (
                <p className="mt-0.5 text-sm text-slate-600">
                  {speaker.coach}
                  <span className="text-slate-400"> · {speaker.credit}</span>
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
