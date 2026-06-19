import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type LessonPageEyebrowCrumb = {
  label: string;
  href?: string;
};

type Props = {
  crumbs: LessonPageEyebrowCrumb[];
};

/** Horizontal breadcrumb strip above lesson player layouts. */
export function LessonPageEyebrow({ crumbs }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500"
    >
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? (
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          ) : null}
          {crumb.href ? (
            <Link href={crumb.href} className="font-medium transition hover:text-sky-700">
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-700">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
