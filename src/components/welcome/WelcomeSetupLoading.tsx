"use client";

export type WelcomeSetupPhase = "confirm" | "provision" | "sign_in";

const STEPS: { id: WelcomeSetupPhase; label: string }[] = [
  { id: "confirm", label: "Payment confirmed" },
  { id: "provision", label: "Setting up your account" },
  { id: "sign_in", label: "Signing you in" },
];

const PHASE_INDEX: Record<WelcomeSetupPhase, number> = {
  confirm: 0,
  provision: 1,
  sign_in: 2,
};

type WelcomeSetupLoadingProps = {
  phase?: WelcomeSetupPhase;
  /** Shown under the steps when something more specific is useful. */
  detail?: string;
};

export function WelcomeSetupLoading({
  phase = "provision",
  detail = "This usually takes a few seconds.",
}: WelcomeSetupLoadingProps) {
  const activeIndex = PHASE_INDEX[phase];
  const progressPct = Math.min(100, ((activeIndex + 1) / STEPS.length) * 100);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[radial-gradient(120%_80%_at_50%_-10%,#dbebff_0%,#f8fafc_42%,#f1f5f9_100%)] px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0c5290]">
          Profit Coach
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Almost there
        </h1>
        <p className="mt-2 text-pretty text-base text-slate-600">{detail}</p>

        <div
          className="mt-8 h-1.5 overflow-hidden rounded-full bg-slate-200/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          aria-label="Account setup progress"
        >
          <div
            className="h-full rounded-full bg-[#0c5290] transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <ol className="mt-8 space-y-3 text-left">
          {STEPS.map((step, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            return (
              <li
                key={step.id}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                  active
                    ? "border-[#0c5290]/25 bg-white shadow-sm"
                    : done
                      ? "border-emerald-200/80 bg-emerald-50/60"
                      : "border-slate-200/80 bg-white/50"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-[#0c5290] text-white"
                        : "bg-slate-100 text-slate-500"
                  }`}
                  aria-hidden
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={`text-sm font-medium ${
                    active
                      ? "text-slate-900"
                      : done
                        ? "text-emerald-900"
                        : "text-slate-500"
                  }`}
                >
                  {step.label}
                  {active ? "…" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
