"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { Lato, Montserrat } from "next/font/google";
import { CalendarEmbed } from "@/components/CalendarEmbed";
import type { DoubleProfitsCoach } from "@/lib/getDoubleProfitsCoach";
import { PAM_CALENDAR_EMBED_CODE } from "@/lib/doubleProfitsLandingCopy";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

type DoubleProfitsLandingProps = {
  coach: DoubleProfitsCoach;
};

function scrollToCalendar() {
  document.getElementById("book-calendar")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function ClaimButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "malibu";
  className?: string;
}) {
  const styles =
    variant === "malibu"
      ? "bg-[#63b3ed] hover:bg-[#4fa8e8]"
      : "bg-[#188bf6] hover:bg-[#1478d4]";

  return (
    <button
      type="button"
      onClick={scrollToCalendar}
      className={`inline-flex items-center justify-center rounded-md px-5 py-3.5 text-lg font-semibold text-white transition ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function DoubleProfitsLanding({ coach }: DoubleProfitsLandingProps) {
  const { copy } = coach;
  const [calendarEmbed, setCalendarEmbed] = useState<string | null>(
    coach.calendarEmbedCode
  );

  useEffect(() => {
    if (coach.calendarEmbedCode) {
      setCalendarEmbed(coach.calendarEmbedCode);
      return;
    }

    let cancelled = false;
    void fetch(`/api/public/coaches/${encodeURIComponent(coach.slug)}/calendar`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { calendar_embed_code?: string | null } | null) => {
        if (cancelled) return;
        setCalendarEmbed(
          data?.calendar_embed_code ??
            (coach.slug === "pam" ? PAM_CALENDAR_EMBED_CODE : null)
        );
      })
      .catch(() => {
        if (!cancelled && coach.slug === "pam") {
          setCalendarEmbed(PAM_CALENDAR_EMBED_CODE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [coach.calendarEmbedCode, coach.slug]);

  return (
    <div
      className={`${montserrat.className} ${lato.className} min-h-screen bg-white text-[#565a7c]`}
    >
      {/* Hero */}
      <section className="bg-[#f6f6ff] px-4 py-8 sm:px-6 lg:py-12">
        <div className="mx-auto grid max-w-[1170px] items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
          <div className="order-2 lg:order-1">
            <Image
              src="/brand/profit-coach-logo-colour-no-bg.png"
              alt="Profit Coach"
              width={250}
              height={72}
              className="h-auto w-[200px] sm:w-[250px]"
              priority
            />

            <p className="mt-8 pl-0 text-sm font-normal uppercase tracking-[0.2em] text-[#2291eb] sm:pl-5 sm:text-lg">
              {copy.eyebrow}
            </p>

            <h1 className="mt-2 max-w-2xl pl-0 text-[clamp(2rem,4.5vw,2.875rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-[#0c5290] sm:pl-5">
              {copy.headline}
            </h1>

            <p className="mt-5 max-w-2xl pl-0 text-base leading-relaxed sm:pl-5 sm:text-xl">
              {copy.intro}
            </p>

            <p className="mt-5 max-w-2xl pl-0 text-base font-bold leading-relaxed text-[#565a7c] sm:pl-5 sm:text-xl">
              {copy.sessionPitch}
            </p>

            <ul className="mt-6 space-y-4 pl-0 sm:pl-5">
              {copy.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 text-base leading-relaxed sm:text-xl"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2291eb]/10 text-[#2291eb]">
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            id="book-calendar"
            className="order-1 scroll-mt-6 lg:order-2 lg:sticky lg:top-6"
          >
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {calendarEmbed ? (
                <CalendarEmbed embedCode={calendarEmbed} />
              ) : (
                <div className="flex min-h-[520px] items-center justify-center p-8 text-center text-sm text-slate-500">
                  Loading calendar…
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Why this call */}
      <section className="px-4 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-[1170px] gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
          <div>
            <h2 className="text-[clamp(2rem,4vw,2.25rem)] font-semibold leading-tight tracking-[0.02em] text-[#0b5191]">
              {copy.whyHeading}
            </h2>
            <div className="mt-4 h-[3px] w-[10%] bg-[#2e91fc]" />
          </div>
          <div className="space-y-5">
            <p className="text-lg font-medium leading-snug text-[#0b5191] sm:text-[23px]">
              {copy.whyLead}
            </p>
            <p className="text-lg leading-relaxed text-[#8893a8] sm:text-[18px]">
              {copy.whyBody}
            </p>
          </div>
        </div>
      </section>

      {/* Who is this for */}
      <section className="bg-[#188bf6] px-4 py-14 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-[680px] text-center">
          <p className="text-lg uppercase tracking-[0.18em] text-[#42a1ee]">
            {copy.audienceLabel}
          </p>
          <h2 className="mt-3 text-[clamp(1.75rem,4vw,2.25rem)] font-semibold leading-tight text-white">
            {copy.audienceHeading}
          </h2>

          <ul className="mt-8 space-y-3 text-left text-lg leading-relaxed text-[#f9fafb] sm:text-xl">
            {copy.audienceBullets.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#d1ac58]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <ClaimButton variant="malibu">{copy.ctaLabel}</ClaimButton>
          </div>
        </div>
      </section>

      {/* Meet coach */}
      <section className="bg-[#f6f6ff] px-4 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-[1170px] items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            {coach.avatarUrl ? (
              <Image
                src={coach.avatarUrl}
                alt={coach.fullName}
                width={640}
                height={800}
                className="h-auto w-full rounded-sm object-cover object-top shadow-sm"
                unoptimized
              />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center rounded-sm bg-slate-200 text-slate-500">
                No photo
              </div>
            )}
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[#0038ff] sm:text-lg">
              {copy.meetLabel}
            </p>
            <h2 className="mt-3 text-[clamp(2rem,4.5vw,2.875rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-[#0c5290]">
              {copy.meetHeading}
            </h2>

            <div className="mt-6 space-y-5 text-base leading-relaxed sm:text-xl">
              {copy.bioParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial + final CTA */}
      <section className="bg-[#0b5191] px-4 py-14 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-[950px] text-center text-[#f6f6ff]">
          <p className="text-lg font-semibold italic sm:text-xl">
            &ldquo;{copy.testimonial.quote}&rdquo;
          </p>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed sm:text-lg">
            &ldquo;{copy.testimonial.body}&rdquo;
          </p>

          <p className="mt-6 text-base sm:text-lg">
            - {copy.testimonial.author}
            {copy.testimonial.authorUrl ? (
              <>
                {" "}
                (
                <a
                  href={copy.testimonial.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  {copy.testimonial.authorUrl.replace(/^https?:\/\//, "")}
                </a>
                )
              </>
            ) : null}
          </p>

          <div className="mt-10">
            <ClaimButton>{copy.ctaLabel}</ClaimButton>
          </div>
        </div>
      </section>
    </div>
  );
}
