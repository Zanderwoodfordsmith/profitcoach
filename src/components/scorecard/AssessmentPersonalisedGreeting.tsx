type AssessmentPersonalisedGreetingProps = {
  firstName?: string | null;
  /** Intro card uses larger type; header uses compact. */
  variant?: "intro" | "header";
};

export function AssessmentPersonalisedGreeting({
  firstName,
  variant = "intro",
}: AssessmentPersonalisedGreetingProps) {
  const name = firstName?.trim();
  if (!name) return null;

  if (variant === "header") {
    return (
      <p className="text-sm font-semibold text-slate-800">
        Hi {name},
      </p>
    );
  }

  return (
    <p className="text-2xl font-bold leading-snug text-slate-900 md:text-[1.75rem] md:leading-snug">
      Hi {name},
    </p>
  );
}
