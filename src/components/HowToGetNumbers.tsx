import { Tooltip } from "@/components/Tooltip";

export function HowToGetNumbers() {
  const tip =
    "Use the same time window for every box (e.g. last 7 days). Pull connection requests and connection stats from LinkedIn / Sales Nav; use your CRM or calendar for booked, showed, and closed.";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            How to get these numbers
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Use one consistent window for all stages. Count connection requests,
            then each downstream outcome in that same period so rates are
            comparable.
          </p>
        </div>
        <Tooltip label={tip}>
          <button
            type="button"
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            Tip
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
