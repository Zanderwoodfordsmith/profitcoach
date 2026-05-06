"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { BossWheel } from "@/components/landing/BossWheel";

const LANDING_CONTACT_KEY = "boss_landing_contact";
const SESSION_COOKIE = "landing_session_id";

const COUNTRY_CODES = [
  { code: "+44", label: "UK +44" },
  { code: "+353", label: "IE +353" },
  { code: "+1", label: "US/CA +1" },
  { code: "+61", label: "AU +61" },
  { code: "+64", label: "NZ +64" },
  { code: "+27", label: "ZA +27" },
  { code: "+31", label: "NL +31" },
  { code: "+32", label: "BE +32" },
  { code: "+33", label: "FR +33" },
  { code: "+34", label: "ES +34" },
  { code: "+39", label: "IT +39" },
  { code: "+41", label: "CH +41" },
  { code: "+43", label: "AT +43" },
  { code: "+45", label: "DK +45" },
  { code: "+46", label: "SE +46" },
  { code: "+47", label: "NO +47" },
  { code: "+48", label: "PL +48" },
  { code: "+49", label: "DE +49" },
  { code: "+351", label: "PT +351" },
  { code: "+358", label: "FI +358" },
  { code: "+81", label: "JP +81" },
  { code: "+82", label: "KR +82" },
  { code: "+86", label: "CN +86" },
  { code: "+91", label: "IN +91" },
  { code: "+971", label: "UAE +971" },
  { code: "+966", label: "SA +966" },
  { code: "+55", label: "BR +55" },
  { code: "+52", label: "MX +52" },
] as const;

function getOrSetSessionId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^| )${SESSION_COOKIE}=([^;]+)`));
  if (match) return match[1];
  const id = crypto.randomUUID?.() ?? `s${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.cookie = `${SESSION_COOKIE}=${id};path=/;max-age=2592000`;
  return id;
}

type CoachInfo = {
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
};

type LandingVariantLegacyProps = {
  coachSlug: string;
  coach: CoachInfo | null;
  loadingCoach: boolean;
  formStep: 1 | 2 | 3;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  formError: string | null;
  submitting: boolean;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhoneCountryCode: (v: string) => void;
  setPhone: (v: string) => void;
  handleStep1: (e: React.FormEvent) => void;
  handleStep2: (e: React.FormEvent) => void;
  handleStep3Submit: (e: React.FormEvent) => void;
  goBack: () => void;
  scrollToForm: () => void;
};

export default function LandingVariantPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const variant = (params.variant as string)?.toLowerCase();
  const coachSlug = searchParams.get("coach")?.trim() || "BCA";

  const router = useRouter();
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(true);
  const viewTracked = useRef(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+44");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isVariantA = variant === "a";
  const isVariantB = variant === "b";
  const validVariant = isVariantA || isVariantB;
  const trackVariant = isVariantA ? "a" : "b";

  useEffect(() => {
    if (!validVariant) return;
    const sessionId = getOrSetSessionId();
    if (viewTracked.current) return;
    viewTracked.current = true;
    fetch("/api/landing/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: trackVariant,
        coach_slug: coachSlug || null,
        event_type: "view",
        session_id: sessionId,
      }),
    }).catch(() => {});
  }, [validVariant, trackVariant, coachSlug]);

  useEffect(() => {
    let cancelled = false;
    if (!coachSlug) {
      setLoadingCoach(false);
      return;
    }
    async function load() {
      const { data, error } = await supabaseClient
        .from("coaches")
        .select("slug, profiles(full_name, coach_business_name, avatar_url, linkedin_url)")
        .eq("slug", coachSlug)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        const row = data as unknown as {
          slug: string;
          profiles?: CoachInfo | CoachInfo[] | null;
        };
        const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        if (prof) setCoach(prof);
      }
      setLoadingCoach(false);
    }
    load();
    return () => { cancelled = true; };
  }, [coachSlug]);

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) {
      setFormError("Please enter your first name.");
      return;
    }
    if (!last) {
      setFormError("Please enter your last name.");
      return;
    }
    setFormStep(2);
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const emailVal = email.trim();
    if (!emailVal) {
      setFormError("Please enter your email.");
      return;
    }
    setFormStep(3);
  }

  function handleStep3Submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const phoneVal = phone.trim();
    if (!phoneVal) {
      setFormError("Please enter your phone number.");
      return;
    }
    const first = firstName.trim();
    const last = lastName.trim();
    const emailVal = email.trim();
    const fullPhone = `${phoneCountryCode} ${phoneVal}`.trim();
    const fullName = [first, last].filter(Boolean).join(" ");
    setSubmitting(true);
    fetch("/api/landing/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: trackVariant,
        coach_slug: coachSlug || null,
        event_type: "opt_in",
      }),
    }).catch(() => {});
    try {
      sessionStorage.setItem(
        LANDING_CONTACT_KEY,
        JSON.stringify({
          firstName: first,
          lastName: last,
          fullName: fullName || undefined,
          email: emailVal,
          phone: fullPhone,
        })
      );
    } catch {
      // ignore
    }
    router.push(`/assessment/${encodeURIComponent(coachSlug)}?from_landing=${trackVariant}`);
  }

  function goBack() {
    setFormError(null);
    setFormStep((s) => (s > 1 ? (s - 1) as 1 | 2 | 3 : s));
  }

  function scrollToForm() {
    document.getElementById("landing-form")?.scrollIntoView({ behavior: "smooth" });
  }

  if (!validVariant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
        <p className="text-slate-600">Invalid variant. Use /landing/a or /landing/b.</p>
      </div>
    );
  }

  const legacyProps: LandingVariantLegacyProps = {
    coachSlug,
    coach,
    loadingCoach,
    formStep,
    firstName,
    lastName,
    email,
    phoneCountryCode,
    phone,
    formError,
    submitting,
    setFirstName,
    setLastName,
    setEmail,
    setPhoneCountryCode,
    setPhone,
    handleStep1,
    handleStep2,
    handleStep3Submit,
    goBack,
    scrollToForm,
  };

  return isVariantA ? <LandingVariantA {...legacyProps} /> : <LandingVariantLegacy {...legacyProps} />;
}

function LandingVariantLegacy(props: LandingVariantLegacyProps) {
  const {
    coachSlug,
    coach,
    loadingCoach,
    formStep,
    firstName,
    lastName,
    email,
    phoneCountryCode,
    phone,
    formError,
    submitting,
    setFirstName,
    setLastName,
    setEmail,
    setPhoneCountryCode,
    setPhone,
    handleStep1,
    handleStep2,
    handleStep3Submit,
    goBack,
    scrollToForm,
  } = props;

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900">
      {/* Header, Profit Coach logo, smaller, at ~90% page width */}
      <header className="sticky top-0 z-10 bg-white">
        <div className="flex h-16 w-full max-w-[90%] mx-auto items-center justify-end pr-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/profit-coach-logo.svg"
            alt="Profit Coach"
            width={140}
            height={40}
            className="h-8 w-auto object-contain object-right"
          />
        </div>
      </header>

      <main>
        {/* Hero, one column, centred */}
        <section className="bg-white px-4 pt-0 pb-8 sm:pb-12 lg:pb-16">
          <div className="mx-auto w-full max-w-6xl flex flex-col items-center text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl xl:text-6xl leading-[1.2] max-w-[75%]">
              Get Your <span className="text-[#0c5290] underline decoration-2 underline-offset-4">Personalized Profit Plan</span> in Under 15 Minutes
            </h1>
            <p className="mt-4 text-xl text-slate-700 sm:text-2xl max-w-4xl leading-snug">
              Score your business across 10 critical areas, see which of the 5 owner levels you&apos;re really at, and <strong className="font-bold text-slate-900">get the 3 fixes that will grow profit and cut your hours next.</strong>
            </p>

            {/* BOSS grid image */}
            <div className="mt-8 w-full max-w-[45rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/boss-grid-placeholder.png"
                alt="BOSS grid, 5 owner levels, 10 business areas"
                className="w-full rounded-2xl border border-slate-200 shadow-xl object-contain bg-slate-50/50"
              />
            </div>

            {/* Form */}
            <div id="landing-form" className="scroll-mt-24 mt-10 w-full max-w-xl">
              <div className="space-y-6">
                {formStep === 1 && (
                  <form onSubmit={handleStep1} className="space-y-6">
                    <p className="text-2xl sm:text-3xl text-slate-900">
                      What&apos;s your <strong className="font-bold">name?</strong>
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="landing-firstName" className="sr-only">First name</label>
                        <input
                          id="landing-firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-4 text-lg text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/20"
                          placeholder="First name"
                        />
                      </div>
                      <div>
                        <label htmlFor="landing-lastName" className="sr-only">Last name</label>
                        <input
                          id="landing-lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-4 text-lg text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/20"
                          placeholder="Last name"
                        />
                      </div>
                    </div>
                    {formError && (
                      <p className="text-base text-rose-600" role="alert">{formError}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[#0c5290] px-6 py-4 text-xl font-semibold text-white shadow-lg hover:opacity-95"
                    >
                      Get my Profit Plan
                    </button>
                  </form>
                )}
                {formStep === 2 && (
                  <form onSubmit={handleStep2} className="space-y-6">
                    <p className="text-2xl sm:text-3xl text-slate-900">
                      Where should I <strong className="font-bold">email</strong> it to?
                    </p>
                    <div>
                      <label htmlFor="landing-email" className="sr-only">Email</label>
                      <input
                        id="landing-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-4 text-lg text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/20"
                        placeholder="e.g. you@company.com"
                      />
                    </div>
                    {formError && (
                      <p className="text-base text-rose-600" role="alert">{formError}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[#0c5290] px-6 py-4 text-xl font-semibold text-white shadow-lg hover:opacity-95"
                    >
                      Continue
                    </button>
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={goBack}
                        className="inline-flex items-center gap-1.5 text-base text-slate-500 hover:text-slate-700"
                      >
                        <span aria-hidden>←</span>
                        Previous
                      </button>
                    </div>
                  </form>
                )}
                {formStep === 3 && (
                  <form onSubmit={handleStep3Submit} className="space-y-6">
                    <p className="text-2xl sm:text-3xl text-slate-900">
                      What is your <strong className="font-bold">phone number?</strong>
                    </p>
                    <div className="flex gap-2">
                      <label htmlFor="landing-phone-country" className="sr-only">Country code</label>
                      <select
                        id="landing-phone-country"
                        value={phoneCountryCode}
                        onChange={(e) => setPhoneCountryCode(e.target.value)}
                        className="w-32 shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-4 text-lg text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/20"
                        aria-label="Country code"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="landing-phone" className="sr-only">Phone number</label>
                      <input
                        id="landing-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-4 text-lg text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/20"
                        placeholder="e.g. 7123 456789"
                      />
                    </div>
                    {formError && (
                      <p className="text-base text-rose-600" role="alert">{formError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-[#0c5290] px-6 py-4 text-xl font-semibold text-white shadow-lg hover:opacity-95 disabled:opacity-70 disabled:cursor-wait"
                    >
                      {submitting ? "Starting…" : "Get my Profit Plan"}
                    </button>
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={goBack}
                        className="inline-flex items-center gap-1.5 text-base text-slate-500 hover:text-slate-700"
                      >
                        <span aria-hidden>←</span>
                        Previous
                      </button>
                    </div>
                  </form>
                )}
                <p className="text-center text-base text-slate-500">
                  Free · Under 15 min · No sales call
                </p>
                {!loadingCoach && (coach?.full_name || coach?.coach_business_name || coachSlug.toUpperCase() === "BCA") && (
                  <p className="pt-4 text-base text-slate-500 border-t border-slate-200">
                    Your results can be shared with your coach{coach?.full_name || coach?.coach_business_name ? `, ${coach.full_name ?? coach.coach_business_name}` : ""}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section 2, This is for you if… (dark blue) */}
        <section className="bg-[#0c5290] py-20 px-4" style={{ backgroundColor: "#0c5290" }}>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              This is for you if…
            </h2>
            <p className="mt-6 text-lg text-sky-100 leading-relaxed">
              You&apos;re an established business owner or director running an SME, somewhere between £1M and £20M, and you recognise yourself in at least one of these:
            </p>
            <ul className="mt-8 space-y-5 text-base text-sky-100 sm:text-lg">
              <li className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span><strong className="text-white">You&apos;re still the chief firefighter.</strong> Every decision, every problem, every important sale still flows through you. You work 50–60+ hours a week and the business can&apos;t run a fortnight without you.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span><strong className="text-white">Feast or famine is your normal.</strong> Some months are great. Others, you&apos;re raiding savings, because there&apos;s no predictable pipeline, no real KPIs, and no system behind the revenue.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span><strong className="text-white">Your management team are good doers but weak leaders.</strong> You&apos;ve lost strong performers. You&apos;re stuck with people who can&apos;t run things.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span><strong className="text-white">You know the business &quot;works&quot;, but only because you&apos;re holding it together.</strong> Profit, order, and control don&apos;t match the effort and risk you carry.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span><strong className="text-white">You don&apos;t have a clear plan.</strong> No 3-year vision, no exit timeline, no way to tell what&apos;s urgent versus what actually matters.</span>
              </li>
            </ul>
            <p className="mt-10 text-xl font-medium text-white">
              If that sounds familiar, the BOSS Scorecard shows you exactly what&apos;s going on under the hood, and what to fix first.
            </p>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-10 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-[#0c5290] shadow-lg hover:bg-slate-100"
            >
              Get my Profit Plan →
            </button>
          </div>
        </section>

        {/* Section 3, How it works */}
        <section className="border-t border-slate-200 bg-white py-20 px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-[#0c5290] sm:text-4xl lg:text-5xl">
              How it works
            </h2>
            <p className="mt-6 text-lg text-slate-600 sm:text-xl">
              Answer 50 quick red / amber / green questions, no prep, no calculators, no essays.
            </p>
            <div className="mt-8 space-y-6 text-slate-600 leading-relaxed">
              <p>
                This scorecard has been built on the Profit System, a structured framework that maps your entire business across 5 Levels of owner growth and 10 areas of business health.
              </p>
              <p>
                You&apos;ll answer 50 simple questions: &quot;Is this in place in my business right now?&quot;, and mark each one red (not in place), amber (partially), or green (fully in place).
              </p>
              <p>
                Behind the scenes, each answer is weighted by level and area. Foundations hit harder than nice-to-haves. Profit, cash, and owner performance are treated as survival, not luxury.
              </p>
              <p>
                Once you&apos;re done, you get your results instantly, no waiting, no sales call required.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-10 rounded-xl bg-[#0c5290] px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:opacity-95"
            >
              Get my Profit Plan →
            </button>
          </div>
        </section>

        {/* Section 4, BOSS grid (image placeholder) */}
        <section className="border-t border-slate-200 bg-[#0c5290] py-20 px-4" style={{ backgroundColor: "#0c5290" }}>
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl text-center">
              See your whole operating system on one page
            </h2>
            <p className="mt-4 text-center text-lg text-sky-100 sm:text-xl max-w-2xl mx-auto">
              Your full BOSS Map, 5 levels, 10 areas, 50 playbooks, colour-coded so you see exactly where you&apos;re strong and where you&apos;re exposed.
            </p>
            <div className="mt-12 flex justify-center">
              <div className="rounded-2xl border-2 border-dashed border-sky-400/50 bg-sky-950/30 px-12 py-16 text-center min-w-[280px]">
                <p className="text-sky-200 font-medium">Your BOSS grid</p>
                <p className="mt-1 text-sm text-sky-300/80">Visual result from your scorecard</p>
              </div>
            </div>
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={scrollToForm}
                className="rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-[#0c5290] shadow-lg hover:bg-slate-100"
              >
                Get my Profit Plan →
              </button>
            </div>
          </div>
        </section>

        {/* Section 5, What you get (with BOSS Wheel) */}
        <section className="border-t border-slate-200 bg-white py-20 px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-[#0c5290] sm:text-4xl lg:text-5xl">
              What you&apos;ll see instantly
            </h2>
            <p className="mt-6 text-lg text-slate-600 sm:text-xl">
              Your personal BOSS Report, no waiting, no sales call, no obligation.
            </p>
            <div className="mt-12 flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
              <BossWheel size={300} />
              <ul className="mt-10 space-y-6 text-base text-slate-700 sm:text-lg flex-1">
              <li>
                <strong className="text-slate-900">Your BOSS Score out of 100</strong>, One number that tells you how strong your business operating system really is. Weighted by level, foundations count more than optimisations.
              </li>
              <li>
                <strong className="text-slate-900">Your Stage</strong>, Know exactly where you are: Overwhelm → Overworked → Organised → Overseer → Owner.
              </li>
              <li>
                <strong className="text-slate-900">Your BOSS Wheel</strong>, A visual map across all 10 areas so you can see the shape of your business at a glance.
              </li>
              <li>
                <strong className="text-slate-900">Your full colour-coded grid</strong>, All 50 playbooks mapped in red, amber, and green across 5 levels and 10 areas.
              </li>
              <li>
                <strong className="text-slate-900">Your score breakdown</strong>, How many areas are fully in place, partially in place, or not in place.
              </li>
              <li>
                <strong className="text-slate-900">Your top 3 priorities for the next 90 days</strong>, The 3 highest-leverage changes most likely to increase profit, reduce chaos, and strengthen your foundations.
              </li>
            </ul>
            </div>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-10 rounded-xl bg-[#0c5290] px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:opacity-95"
            >
              Get my Profit Plan →
            </button>
          </div>
        </section>

        {/* Section 6, Not a fluffy quiz */}
        <section className="border-t border-slate-200 bg-slate-50 py-20 px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-[#0c5290] sm:text-4xl lg:text-5xl">
              This is not a fluffy &quot;business quiz&quot;
            </h2>
            <p className="mt-6 text-slate-600 leading-relaxed">
              Most scorecards are glorified personality tests. The BOSS Scorecard is a Business Operating System X-ray, built for real-world SMEs doing £1M–£20M.
            </p>
            <p className="mt-4 text-slate-600 leading-relaxed">
              It exists to answer three questions:
            </p>
            <ol className="mt-4 list-decimal list-inside space-y-2 text-slate-700 font-medium">
              <li>Where is my business leaking profit?</li>
              <li>Where am I overworking or dangerously exposed?</li>
              <li>What should I fix first?</li>
            </ol>
            <p className="mt-6 text-slate-600 leading-relaxed">
              No theory. No generic advice. Just a clear, visual diagnosis of your specific situation, so you can stop fixing what&apos;s loud and start fixing what actually matters.
            </p>
          </div>
        </section>

        {/* Section 7, What happens after */}
        <section className="border-t border-slate-200 bg-white py-20 px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-[#0c5290] sm:text-4xl lg:text-5xl">
              What happens after you get your score?
            </h2>
            <p className="mt-6 text-slate-600 leading-relaxed">
              Your report is yours to keep. You can review it, share it with your team, and start working on your top priorities immediately.
            </p>
            <p className="mt-4 text-slate-600 leading-relaxed">
              If you&apos;d like a second pair of eyes, you can optionally book a free BOSS Review, a focused session where a Profit Coach walks through your results, unpacks the priorities, and helps you turn them into a 90-day action plan.
            </p>
            <p className="mt-4 text-slate-600 leading-relaxed">
              No pressure. No pitch. Just clarity on what to do next.
            </p>
          </div>
        </section>

        {/* Section 8, Final CTA */}
        <section className="border-t border-slate-200 bg-[#0c5290] py-20 px-4" style={{ backgroundColor: "#0c5290" }}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              See the whole operating system. Then decide what to fix first.
            </h2>
            <p className="mt-6 text-lg text-sky-100 sm:text-xl">
              50 focused questions. Under 10 minutes. Instant results, your BOSS Score, your Stage, your visual map, and your top 3 priorities.
            </p>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-8 inline-flex rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#0c5290] shadow-lg hover:bg-slate-100"
            >
              Get my Profit Plan →
            </button>
            <ul className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-sky-100">
              <li>Free, no cost, no card</li>
              <li>Instant, results on screen immediately</li>
              <li>Private, your answers are confidential</li>
              <li>No sales call required</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-6 px-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-sm text-slate-500">
              BOSS Scorecard · The Profit System
            </span>
            <Link href="/login" className="text-sm font-medium text-[#0c5290] hover:underline">
              Log in
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

function LandingVariantA(props: LandingVariantLegacyProps) {
  const { scrollToForm } = props;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main>
        {/* Hero (match comp: centered stack) */}
        <section className="relative overflow-hidden bg-[#061a2e] text-white">
          <div className="pointer-events-none absolute inset-0 opacity-55">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(66,161,238,0.35),transparent_62%),radial-gradient(circle_at_bottom,rgba(13,148,136,0.22),transparent_55%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:72px_72px]" />
          </div>

          <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:pt-18">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Are You Running Your Business{" "}
                <span className="text-[#42a1ee]">Or Is It Running You?</span>
              </h1>
              <p className="mt-5 text-pretty text-lg leading-relaxed text-white/80 sm:text-xl">
                Successful business owners master all 5 “Owner Levels” across profit, systems, team, and strategy.
                How many have you nailed? Take the free BOSS Scorecard and find out where you really stand.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-5xl">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/35">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/v2/hero.png"
                  alt="BOSS Scorecard preview"
                  className="w-full rounded-2xl object-cover"
                />
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-2xl text-center">
              <button
                type="button"
                onClick={scrollToForm}
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-semibold text-[#061a2e] shadow-lg shadow-black/20 hover:opacity-95"
              >
                Take the Free BOSS Scorecard
              </button>
              <p className="mt-3 text-sm text-white/70">Free · Under 10 min · Instant results</p>
            </div>
          </div>
        </section>

        {/* Form block (white, centered) */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-xl">
              <LandingOptInForm {...props} variant="light" />
            </div>
          </div>
        </section>

        {/* Levels holding you back (match comp: centered header + 2 cards) */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Know exactly which levels are holding your business back
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Your BOSS report shows your score, your level, and what to fix first.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <LevelsList />
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/v2/dashboard.png"
                  alt="Example Profit Coach workspace"
                  className="w-full rounded-2xl object-cover"
                />
              </div>
            </div>

            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={scrollToForm}
                className="inline-flex items-center justify-center rounded-full bg-[#0c5290] px-8 py-4 text-base font-semibold text-white shadow-lg hover:opacity-95"
              >
                Take the Free BOSS Scorecard →
              </button>
            </div>
          </div>
        </section>

        {/* How it works (match comp: 3 stacked rows) */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                How It Works
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Answer a few questions, get your score, and see what to fix first.
              </p>
            </div>

            <div className="mt-10 space-y-6">
              <HowRow
                step="01."
                imageSrc="/landing/v2/how-1.png"
                title="Answer a few questions about how your business runs"
                description="Quick red / amber / green questions across the operating system, no prep, no essays."
              />
              <HowRow
                step="02."
                imageSrc="/landing/v2/how-2.png"
                title="Get your BOSS score out of 100"
                description="A weighted score that highlights foundations first, so you see the real constraint."
              />
              <HowRow
                step="03."
                imageSrc="/landing/v2/how-3.png"
                title="See what to fix first"
                description="Instant clarity on the highest-leverage priorities for profit, control, and time back."
              />
            </div>
          </div>
        </section>

        {/* Final CTA (match comp: blue band) */}
        <section className="relative overflow-hidden bg-[#061a2e] py-16 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(66,161,238,0.30),transparent_60%),radial-gradient(circle_at_bottom,rgba(13,148,136,0.20),transparent_55%)]" />
          </div>
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to build a rewarding business?
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-white/80">
                Take the free BOSS Scorecard and get instant insight into what’s holding you back, and what to do next.
              </p>
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-semibold text-[#061a2e] shadow-lg shadow-black/20 hover:opacity-95"
                >
                  Get started →
                </button>
              </div>
              <p className="mt-5 text-sm text-white/60">Free · Private · Instant</p>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-white py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
            <span className="text-sm text-slate-500">BOSS Scorecard · The Profit System</span>
            <Link href="/login" className="text-sm font-medium text-[#0c5290] hover:underline">
              Log in
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

function LevelsList() {
  const rows = [
    { label: "Overwhelm", pct: 84, color: "#ec4899" },
    { label: "Overworked", pct: 64, color: "#22c55e" },
    { label: "Organised", pct: 47, color: "#8b5cf6" },
    { label: "Overseer", pct: 32, color: "#f97316" },
    { label: "Owner", pct: 12, color: "#ef4444" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">Overview</p>
        <p className="text-sm font-semibold text-[#0c5290]">BOSS Score</p>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{r.label}</p>
              <p className="text-sm font-semibold text-slate-700">{r.pct}%</p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${r.pct}%`, backgroundColor: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowRow(props: { step: string; imageSrc: string; title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.imageSrc}
          alt=""
          className="h-28 w-full rounded-2xl object-cover sm:h-24 sm:w-40"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-500">{props.step}</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{props.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{props.description}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureTile(props: { iconSrc: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={props.iconSrc} alt="" className="h-12 w-12 rounded-xl" />
      <div>
        <p className="font-semibold text-slate-900">{props.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{props.description}</p>
      </div>
    </div>
  );
}

function HowCard(props: { imageSrc: string; eyebrow: string; title: string; description: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.imageSrc}
          alt=""
          className="h-44 w-full rounded-2xl object-cover"
        />
      </div>
      <div className="px-6 pb-6">
        <p className="text-sm font-semibold text-[#0c5290]">{props.eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">{props.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{props.description}</p>
      </div>
    </div>
  );
}

function LandingOptInForm(
  props: LandingVariantLegacyProps & { variant: "dark" | "light" }
) {
  const {
    coachSlug,
    coach,
    loadingCoach,
    formStep,
    firstName,
    lastName,
    email,
    phoneCountryCode,
    phone,
    formError,
    submitting,
    setFirstName,
    setLastName,
    setEmail,
    setPhoneCountryCode,
    setPhone,
    handleStep1,
    handleStep2,
    handleStep3Submit,
    goBack,
  } = props;

  const isDark = props.variant === "dark";
  const cardClass = isDark
    ? "rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/25"
    : "rounded-3xl border border-slate-200 bg-white p-6 shadow-lg";
  const inputClass = isDark
    ? "block w-full rounded-xl border border-white/15 bg-white/10 px-4 py-4 text-base text-white placeholder-white/50 outline-none focus:border-[#42a1ee] focus:ring-2 focus:ring-[#42a1ee]/20"
    : "block w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/20";
  const labelClass = isDark ? "text-white/85" : "text-slate-900";
  const subtleText = isDark ? "text-white/60" : "text-slate-500";
  const errorText = isDark ? "text-rose-200" : "text-rose-600";
  const primaryBtn = isDark
    ? "w-full rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[#061a2e] shadow-lg shadow-black/20 hover:opacity-95"
    : "w-full rounded-xl bg-[#0c5290] px-6 py-4 text-xl font-semibold text-white shadow-lg hover:opacity-95";

  return (
    <div id="landing-form" className="scroll-mt-24">
      <div className={cardClass}>
        <div className="space-y-5">
          {formStep === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <p className={`text-xl font-semibold sm:text-2xl ${labelClass}`}>
                Start with your <span className="font-bold">name</span>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="landingA-firstName" className="sr-only">First name</label>
                  <input
                    id="landingA-firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label htmlFor="landingA-lastName" className="sr-only">Last name</label>
                  <input
                    id="landingA-lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                    placeholder="Last name"
                  />
                </div>
              </div>
              {formError && <p className={`text-sm ${errorText}`} role="alert">{formError}</p>}
              <button type="submit" className={primaryBtn}>
                Get my results
              </button>
            </form>
          )}

          {formStep === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              <p className={`text-xl font-semibold sm:text-2xl ${labelClass}`}>
                Where should I <span className="font-bold">email</span> it?
              </p>
              <div>
                <label htmlFor="landingA-email" className="sr-only">Email</label>
                <input
                  id="landingA-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. you@company.com"
                />
              </div>
              {formError && <p className={`text-sm ${errorText}`} role="alert">{formError}</p>}
              <button type="submit" className={primaryBtn}>
                Continue
              </button>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={goBack}
                  className={`text-sm font-medium hover:underline ${subtleText}`}
                >
                  ← Previous
                </button>
              </div>
            </form>
          )}

          {formStep === 3 && (
            <form onSubmit={handleStep3Submit} className="space-y-5">
              <p className={`text-xl font-semibold sm:text-2xl ${labelClass}`}>
                And your <span className="font-bold">phone number</span>?
              </p>
              <div className="flex gap-2">
                <label htmlFor="landingA-phone-country" className="sr-only">Country code</label>
                <select
                  id="landingA-phone-country"
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className={`${inputClass} !w-28 shrink-0`}
                  aria-label="Country code"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="landingA-phone" className="sr-only">Phone number</label>
                <input
                  id="landingA-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${inputClass} min-w-0 flex-1`}
                  placeholder="e.g. 7123 456789"
                />
              </div>
              {formError && <p className={`text-sm ${errorText}`} role="alert">{formError}</p>}
              <button type="submit" disabled={submitting} className={`${primaryBtn} disabled:opacity-70 disabled:cursor-wait`}>
                {submitting ? "Starting…" : "Get my results"}
              </button>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={goBack}
                  className={`text-sm font-medium hover:underline ${subtleText}`}
                >
                  ← Previous
                </button>
              </div>
            </form>
          )}

          <p className={`text-center text-sm ${subtleText}`}>Free · No sales call · Instant results</p>

          {!loadingCoach && (coach?.full_name || coach?.coach_business_name || coachSlug.toUpperCase() === "BCA") && (
            <p className={`pt-4 text-sm border-t ${isDark ? "border-white/10 text-white/60" : "border-slate-200 text-slate-500"}`}>
              Your results can be shared with your coach
              {coach?.full_name || coach?.coach_business_name ? `, ${coach.full_name ?? coach.coach_business_name}` : ""}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
