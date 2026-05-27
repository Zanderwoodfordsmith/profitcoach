import { ExternalLink } from "lucide-react";

import {
  ACADEMY_RESOURCE_KIND_LABELS,
  type AcademyResourceRow,
} from "@/lib/academy/resources";

type Props = {
  resources: AcademyResourceRow[];
};

export function LessonResourcesPanel({ resources }: Props) {
  if (resources.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
        Lesson resources
      </h2>
      <ul className="mt-3 divide-y divide-slate-200">
        {resources.map((resource) => (
          <li key={resource.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-start gap-2 font-medium text-sky-700 hover:text-sky-900"
              >
                <span>{resource.title}</span>
                <ExternalLink
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40 transition group-hover:opacity-100"
                  aria-hidden
                />
              </a>
              <p className="mt-1 text-xs text-slate-500">
                {ACADEMY_RESOURCE_KIND_LABELS[resource.resource_kind]}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
