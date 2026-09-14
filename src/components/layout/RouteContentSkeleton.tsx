export function RouteContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2" aria-hidden>
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200/80" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
