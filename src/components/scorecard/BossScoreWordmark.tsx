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
