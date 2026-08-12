"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { NativeBookingEmbed } from "@/components/booking/NativeBookingEmbed";
import { WelcomeIntakeSurvey } from "@/components/welcome/WelcomeIntakeSurvey";
import type {
  ProgrammeIntakeGoal,
  ProgrammeIntakeSituation,
  ProgrammeIntakeTimeCommitment,
} from "@/config/programmeIntake";
import {
  PROGRAMME_ORIENTATION_BOOK_SLUG,
  PROGRAMME_ORIENTATION_CALENDAR_SLUG,
} from "@/config/programmeOrientationCalendar";
import {
  PROGRAMME_WELCOME_VIDALYTICS_BASE_URL,
  PROGRAMME_WELCOME_VIDALYTICS_EMBED_ID,
} from "@/config/programmeWelcome";
import { VidalyticsEmbed } from "@/components/welcome/VidalyticsEmbed";
import { splitFullName } from "@/lib/splitFullName";

const CONFETTI_COLORS = [
  "#0c5290",
  "#42a1ee",
  "#75c8ff",
  "#22c55e",
  "#eab308",
  "#f97316",
] as const;

type ConfettiMotion = "up" | "side" | "down";

const CONFETTI_PIECES = Array.from({ length: 64 }, (_, i) => {
  const motion: ConfettiMotion =
    i % 3 === 0 ? "up" : i % 3 === 1 ? "side" : "down";
  return {
    motion,
    left: `${3 + ((i * 17) % 94)}%`,
    top: motion === "down" ? `${(i * 11) % 40}%` : undefined,
    delay: `${(i % 10) * 0.06 + (i > 32 ? 0.25 : 0)}s`,
    duration: `${2.1 + (i % 5) * 0.45}s`,
    width: 5 + (i % 5) * 2,
    height: i % 4 === 0 ? 4 + (i % 3) * 2 : 6 + (i % 4) * 2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    drift: -60 + ((i * 19) % 120),
    wobble: -36 + ((i * 13) % 72),
    round: i % 3 === 0,
  };
});

function WelcomeConfetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      aria-hidden
    >
      {CONFETTI_PIECES.map((piece, i) => {
        const motionClass =
          piece.motion === "up"
            ? "scorecard-confetti-up bottom-0"
            : piece.motion === "side"
              ? "scorecard-confetti-side top-[38%]"
              : "scorecard-confetti-down top-0";

        return (
          <span
            key={i}
            className={`absolute ${motionClass} ${
              piece.round ? "rounded-full" : "rounded-sm"
            }`}
            style={
              {
                left: piece.left,
                top: piece.motion === "down" ? piece.top : undefined,
                width: piece.width,
                height: piece.height,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                "--drift": `${piece.drift}px`,
                "--wobble": `${piece.wobble}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function WelcomeVideo() {
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-900 shadow-[0_24px_60px_-28px_rgba(12,82,144,0.55)] ring-1 ring-slate-900/10">
      <VidalyticsEmbed
        embedId={PROGRAMME_WELCOME_VIDALYTICS_EMBED_ID}
        embedBaseUrl={PROGRAMME_WELCOME_VIDALYTICS_BASE_URL}
        title="Welcome to Profit Coach"
      />
    </div>
  );
}

const inputClassName =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0c5290] focus:ring-2 focus:ring-[#42a1ee]/25 disabled:bg-slate-50 disabled:text-slate-500";

function StepBadge({
  n,
  done,
  active,
}: {
  n: number;
  done?: boolean;
  active?: boolean;
}) {
  if (done) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        active
          ? "bg-[#0c5290] text-white"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
      aria-hidden
    >
      {n}
    </span>
  );
}

function StepCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export type WelcomeCelebrationProps = {
  firstName: string;
  fullName: string;
  email: string;
  phone?: string;
  initialLinkedinUrl?: string;
  /** GHL / share link — no Stripe session; booking + intake still work locally. */
  guest?: boolean;
  preview: boolean;
  continueBusy: boolean;
  passwordError: string | null;
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onContinue: () => void;
  onSaveIntake: (input: {
    linkedinUrl: string;
    situation: ProgrammeIntakeSituation | "";
    goals: ProgrammeIntakeGoal[];
    timeCommitment: ProgrammeIntakeTimeCommitment | "";
  }) => Promise<void>;
};

export function WelcomeCelebration({
  firstName,
  fullName,
  email,
  phone = "",
  initialLinkedinUrl = "",
  guest = false,
  preview,
  continueBusy,
  passwordError,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onContinue,
  onSaveIntake,
}: WelcomeCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [previewToastVisible, setPreviewToastVisible] = useState(preview);
  const [booked, setBooked] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(true);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedinUrl);
  const [situation, setSituation] = useState<ProgrammeIntakeSituation | "">("");
  const [goals, setGoals] = useState<ProgrammeIntakeGoal[]>([]);
  const [timeCommitment, setTimeCommitment] = useState<
    ProgrammeIntakeTimeCommitment | ""
  >("");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeDone, setIntakeDone] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const bookingContact = useMemo(() => {
    const split = splitFullName(fullName);
    return {
      firstName: (split.first_name || firstName || "").trim(),
      lastName: (split.last_name || "").trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    };
  }, [email, firstName, fullName, phone]);

  const showBookingBody = !booked && bookingOpen;
  const showIntakeBody = !intakeDone && (intakeOpen || booked);
  const showPortalBody = portalOpen || intakeDone;

  useEffect(() => {
    const t = window.setTimeout(() => setShowConfetti(false), 4200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!preview) return;
    setPreviewToastVisible(true);
    const t = window.setTimeout(() => setPreviewToastVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [preview]);

  useEffect(() => {
    if (booked && !intakeDone) setIntakeOpen(true);
  }, [booked, intakeDone]);

  useEffect(() => {
    if (intakeDone) setPortalOpen(true);
  }, [intakeDone]);

  async function handleSaveIntake() {
    setIntakeError(null);
    if (preview || guest) {
      setIntakeDone(true);
      return;
    }
    setIntakeBusy(true);
    try {
      await onSaveIntake({
        linkedinUrl,
        situation,
        goals,
        timeCommitment,
      });
      setIntakeDone(true);
    } catch (error) {
      setIntakeError(
        error instanceof Error ? error.message : "Unable to save intake."
      );
    } finally {
      setIntakeBusy(false);
    }
  }

  function toggleGoal(value: ProgrammeIntakeGoal) {
    setGoals((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(120%_80%_at_50%_-10%,#dbebff_0%,#f8fafc_42%,#f1f5f9_100%)]">
      <WelcomeConfetti active={showConfetti} />

      {preview && previewToastVisible ? (
        <div
          className="fixed bottom-4 right-4 z-30 max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950 shadow-lg shadow-slate-900/10"
          role="status"
        >
          <p className="font-medium">Admin preview</p>
          <p className="mt-0.5 text-amber-900/85">
            Stripe skipped · password not saved
          </p>
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <header className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0c5290]">
            Payment confirmed
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Congratulations, {firstName}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            Book your orientation call when you can — intake and portal access
            are available below if you need them first.
          </p>
        </header>

        <div className="mt-8 sm:mt-10">
          <WelcomeVideo />
        </div>

        <div className="mt-10 flex flex-col gap-3">
          {/* Step 1 */}
          <StepCard
            className={
              booked
                ? "border-emerald-200 bg-emerald-50/70"
                : showBookingBody
                  ? "ring-1 ring-[#0c5290]/10"
                  : ""
            }
          >
            {booked ? (
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <StepBadge n={1} done />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-900">
                    Orientation call booked
                  </p>
                  <p className="truncate text-xs text-emerald-800/80">
                    You’re activated — continue below when you’re ready.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => setBookingOpen((v) => !v)}
                  className="flex w-full items-start gap-3 text-left"
                  aria-expanded={showBookingBody}
                >
                  <StepBadge n={1} active={showBookingBody} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-900">
                      Book your orientation call
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Pick a time. Nothing else is required.
                    </p>
                  </div>
                  {showBookingBody ? (
                    <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                  )}
                </button>

                {showBookingBody ? (
                  <div className="mt-4">
                    <NativeBookingEmbed
                      slug={PROGRAMME_ORIENTATION_BOOK_SLUG}
                      calendarSlug={PROGRAMME_ORIENTATION_CALENDAR_SLUG}
                      contact={bookingContact}
                      embedded
                      confirmLabel="Confirm My Orientation Call"
                      hideSuccessPanel
                      hideThanks
                      question="What time works best for you?"
                      onBooked={() => setBooked(true)}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </StepCard>

          {/* Step 2 */}
          <StepCard
            className={
              intakeDone
                ? "border-emerald-200 bg-emerald-50/70"
                : showIntakeBody
                  ? "ring-1 ring-[#0c5290]/10"
                  : ""
            }
          >
            {intakeDone ? (
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <StepBadge n={2} done />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-900">
                    Intake complete
                  </p>
                  <p className="truncate text-xs text-emerald-800/80">
                    Thanks — open the portal when you’re ready.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => setIntakeOpen((v) => !v)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <StepBadge n={2} active={showIntakeBody} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-900">
                      3-minute intake
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Optional — helps us prepare. Open anytime, even before you
                      book.
                    </p>
                  </div>
                  {showIntakeBody ? (
                    <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                  )}
                </button>

                {showIntakeBody ? (
                  <div className="mt-5">
                    {intakeError ? (
                      <p className="mb-3 text-sm text-rose-600" role="alert">
                        {intakeError}
                      </p>
                    ) : null}
                    <WelcomeIntakeSurvey
                      situation={situation}
                      goals={goals}
                      timeCommitment={timeCommitment}
                      linkedinUrl={linkedinUrl}
                      busy={intakeBusy}
                      onSituation={setSituation}
                      onToggleGoal={toggleGoal}
                      onTimeCommitment={setTimeCommitment}
                      onLinkedinUrl={setLinkedinUrl}
                      onComplete={() => void handleSaveIntake()}
                      onSkip={() => setIntakeDone(true)}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </StepCard>

          {/* Step 3 */}
          <StepCard
            className={showPortalBody ? "ring-1 ring-[#0c5290]/10" : ""}
          >
            <div className="p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setPortalOpen((v) => !v)}
                className="flex w-full items-start gap-3 text-left"
              >
                <StepBadge n={3} active={showPortalBody} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900">
                    Access the portal
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {guest
                      ? "Sign in to open Start Here — available even if you book later."
                      : "Set a password and open Start Here — available even if you book later."}
                  </p>
                </div>
                {showPortalBody ? (
                  <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                )}
              </button>

              {showPortalBody ? (
                <div className="mt-5 space-y-3">
                  {guest ? (
                    <>
                      <p className="text-sm text-slate-600">
                        Use the email from your welcome link
                        {email.trim() ? (
                          <>
                            {" "}
                            (<span className="font-medium text-slate-900">
                              ({email.trim()})
                            </span>
                          </>
                        ) : null}{" "}
                        to sign in, then continue into Start Here.
                      </p>
                      <button
                        type="button"
                        onClick={onContinue}
                        disabled={continueBusy}
                        className="inline-flex w-full items-center justify-center rounded-full bg-[#0c5290] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a4274] disabled:cursor-wait disabled:opacity-60"
                      >
                        {continueBusy ? "Opening…" : "Sign in to Start Here"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-slate-600">
                            New password
                          </span>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            className={inputClassName}
                            placeholder="At least 8 characters"
                            disabled={continueBusy}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-slate-600">
                            Confirm password
                          </span>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) =>
                              onConfirmPasswordChange(e.target.value)
                            }
                            className={inputClassName}
                            placeholder="Confirm"
                            disabled={continueBusy}
                          />
                        </label>
                      </div>
                      {passwordError ? (
                        <p className="text-sm text-rose-600" role="alert">
                          {passwordError}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={onContinue}
                        disabled={continueBusy}
                        className="inline-flex w-full items-center justify-center rounded-full bg-[#0c5290] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a4274] disabled:cursor-wait disabled:opacity-60"
                      >
                        {continueBusy ? "Opening portal…" : "Open Start Here"}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </StepCard>
        </div>
      </div>
    </div>
  );
}
