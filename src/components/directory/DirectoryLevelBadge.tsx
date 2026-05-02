const STYLES: Record<string, string> = {
  certified: "bg-sky-700 text-white",
  professional: "bg-emerald-700 text-white",
  elite: "bg-amber-600 text-white",
};

export function DirectoryLevelBadge({
  level,
  className = "",
}: {
  level: string | null;
  className?: string;
}) {
  if (!level) return null;
  const key = level.toLowerCase();
  const bg = STYLES[key] ?? "bg-slate-600 text-white";
  const label =
    key === "certified"
      ? "Certified"
      : key === "professional"
        ? "Professional"
        : key === "elite"
          ? "Elite"
          : level;

  return (
    <span
      className={`inline-block w-full py-1.5 text-center text-xs font-bold uppercase tracking-wider ${bg} ${className}`}
    >
      {label}
    </span>
  );
}
