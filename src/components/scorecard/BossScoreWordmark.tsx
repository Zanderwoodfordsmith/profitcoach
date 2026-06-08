/** Shared BossScore title styling (assessment + results). */
export const BOSS_SCORE_TITLE_GRADIENT =
  "linear-gradient(92deg, #0a5291 0%, #36adf4 48%, #62b9f7 100%)";

type BossScoreWordmarkProps = {
  className?: string;
};

export function BossScoreWordmark({ className }: BossScoreWordmarkProps) {
  return (
    <span className={className}>
      <span className="text-slate-600">Boss</span>
      <span
        className="bg-clip-text text-transparent"
        style={{ backgroundImage: BOSS_SCORE_TITLE_GRADIENT }}
      >
        Score
      </span>
    </span>
  );
}

type BossScoreProWordmarkProps = {
  className?: string;
  /** Hero intro title vs in-flow assessment header */
  variant?: "hero" | "header";
};

export function BossScoreProWordmark({
  className,
  variant = "hero",
}: BossScoreProWordmarkProps) {
  const badgeClass =
    variant === "hero"
      ? "-right-3 -top-2 px-2 py-0.5 text-[0.28em] sm:-right-4 sm:-top-2.5 sm:px-2.5 sm:py-1 sm:text-[0.26em] md:-right-5 md:-top-3"
      : "-right-2 -top-1.5 px-1.5 py-0.5 text-[0.32em] sm:-right-2.5 sm:-top-2";

  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <BossScoreWordmark />
      <span
        className={`absolute rounded-md font-bold uppercase tracking-[0.14em] text-white shadow-sm ${badgeClass}`}
        style={{ backgroundImage: BOSS_SCORE_TITLE_GRADIENT }}
        aria-label="Pro tier"
      >
        Pro
      </span>
    </span>
  );
}

type BossScoreThankYouHeadingProps = {
  className?: string;
};

export function BossScoreThankYouHeading({
  className,
}: BossScoreThankYouHeadingProps) {
  return (
    <h1
      className={`text-center font-semibold leading-tight tracking-tight text-slate-900 ${className ?? ""}`}
    >
      <span className="block text-2xl md:text-3xl lg:text-4xl">
        Thank you for taking the
      </span>
      <span className="mt-2 block text-5xl sm:text-6xl md:text-7xl">
        <BossScoreWordmark />
      </span>
    </h1>
  );
}

export function BossScoreProThankYouHeading({
  className,
}: BossScoreThankYouHeadingProps) {
  return (
    <h1
      className={`text-center font-semibold leading-tight tracking-tight text-slate-900 ${className ?? ""}`}
    >
      <span className="block text-2xl md:text-3xl lg:text-4xl">
        Thank you for taking the
      </span>
      <span className="mt-3 block pt-1 text-5xl sm:mt-3.5 sm:pt-1.5 sm:text-6xl md:mt-4 md:text-7xl">
        <BossScoreProWordmark variant="hero" />
      </span>
    </h1>
  );
}
