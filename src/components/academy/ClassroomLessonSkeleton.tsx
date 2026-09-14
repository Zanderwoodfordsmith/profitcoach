export function ClassroomLessonBodySkeleton() {
  return (
    <>
      <div className="px-6 md:px-8">
        <div className="aspect-video animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="space-y-3 px-6 pb-8 pt-4 md:px-8">
        <div className="flex gap-4">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-slate-100" />
      </div>
    </>
  );
}

export function ClassroomLessonSkeleton() {
  return (
    <div className="flex flex-col gap-5 pt-[15px]">
      <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <aside className="w-full shrink-0 lg:w-[22.5rem]" aria-hidden>
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200/80" />
          <div className="mt-3 h-7 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-6 w-full animate-pulse rounded-full bg-slate-200/80" />
          <ul className="mt-6 space-y-2">
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index} className="h-8 animate-pulse rounded-md bg-slate-100" />
            ))}
          </ul>
        </aside>
        <article className="min-w-0 flex-1">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
            <div className="px-6 pb-4 pt-5 md:px-8 md:pb-5 md:pt-6">
              <div className="h-7 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
            <ClassroomLessonBodySkeleton />
          </div>
        </article>
      </div>
    </div>
  );
}
