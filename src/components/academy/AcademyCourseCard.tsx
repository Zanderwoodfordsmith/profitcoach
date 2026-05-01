import Link from "next/link";

type Props = {
  href: string;
  title: string;
  description: string;
  categoryTitle: string;
  lessonCount: number;
  coverImageUrl?: string;
};

export function AcademyCourseCard({
  href,
  title,
  description,
  categoryTitle,
  lessonCount,
  coverImageUrl,
}: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
    >
      <div className="relative aspect-[16/9] bg-slate-200">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-medium text-slate-500">
            Course cover
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {categoryTitle}
        </p>
        <h2 className="text-lg font-semibold text-slate-900 group-hover:text-sky-800">
          {title}
        </h2>
        <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
          {description || " "}
        </p>
        <p className="mt-auto pt-3 text-xs text-slate-500">
          {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
        </p>
      </div>
    </Link>
  );
}
