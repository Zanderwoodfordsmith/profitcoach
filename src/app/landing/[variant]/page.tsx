"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

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
    // Fire the partial-lead capture as soon as we have an email — even if the
    // prospect bails before phone/assessment. Fire-and-forget; never block
    // the funnel on this.
    const first = firstName.trim();
    const last = lastName.trim();
    fetch("/api/leads/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachSlug: coachSlug || null,
        contact: {
          first_name: first || undefined,
          last_name: last || undefined,
          full_name: [first, last].filter(Boolean).join(" ") || undefined,
          email: emailVal,
        },
      }),
    }).catch(() => {});
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
    // Re-fire lead capture now that we also have phone — same contact_id
    // gets returned, so downstream webhook consumers can dedupe.
    fetch("/api/leads/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachSlug: coachSlug || null,
        contact: {
          first_name: first || undefined,
          last_name: last || undefined,
          full_name: fullName || undefined,
          email: emailVal,
          phone: fullPhone || undefined,
        },
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
  return <BossInspiredLanding {...props} kind="legacy" />;
}

function LandingVariantA(props: LandingVariantLegacyProps) {
  return <BossInspiredLanding {...props} kind="newCopy" />;
}

type LandingKind = "legacy" | "newCopy";
type FeatureItem = { title: string; text: string };
type LandingContent = {
  eyebrow: string;
  heading: string;
  subheading: string;
  cta: string;
  heroStats: Array<{ k: string; v: string }>;
  painHeading: string;
  painIntro: string;
  painBullets: string[];
  painCloser: string;
  valueHeading: string;
  values: FeatureItem[];
  closeHeading: string;
  closeSubheading: string;
};

function BossInspiredLanding(props: LandingVariantLegacyProps & { kind: LandingKind }) {
  const { scrollToForm } = props;
  const content = getLandingContent(props.kind);
  return (
    <div className="min-h-screen bg-[#f5f8fc] text-slate-900">
      <main>
        <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0c5290_0%,#073157_55%,#061a2e_100%)] px-4 py-24 text-white sm:py-28">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_88%_18%,rgba(66,161,238,0.55),transparent_55%),radial-gradient(ellipse_50%_50%_at_8%_80%,rgba(28,160,194,0.40),transparent_55%),radial-gradient(ellipse_30%_40%_at_50%_100%,rgba(16,185,129,0.18),transparent_60%)] opacity-55" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[size:60px_60px] opacity-10" />
          </div>

          <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold tracking-[0.2em] text-white">FREE 12 MIN</span>
                <span className="text-xs font-semibold tracking-[0.04em] text-sky-100">{content.eyebrow}</span>
              </div>
              <h1 className="mt-6 text-balance text-[clamp(40px,5.6vw,80px)] font-light leading-[1.0] tracking-[-0.04em]">{content.heading}</h1>
              <p className="mt-5 max-w-2xl text-[19px] leading-relaxed text-sky-100">{content.subheading}</p>
              <button
                type="button"
                onClick={scrollToForm}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 px-8 py-4 text-base font-bold text-white shadow-[0_20px_44px_-14px_rgba(16,185,129,0.55)] transition hover:brightness-110"
              >
                {content.cta}
              </button>
              <div className="mt-8 flex flex-wrap gap-7 border-t border-white/20 pt-6">
                {content.heroStats.map((stat) => (
                  <div key={stat.k} className="flex flex-col">
                    <span className="font-mono text-lg font-bold text-white">{stat.k}</span>
                    <span className="text-xs text-sky-200">{stat.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <LandingOptInForm {...props} variant="dark" cta={content.cta} />
          </div>
        </section>

        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
            <h2 className="text-balance text-[clamp(32px,4.4vw,52px)] font-light leading-[1.06] tracking-[-0.035em] text-[#0f172a]">{content.painHeading}</h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">{content.painIntro}</p>
            <ul className="mt-8 space-y-4 text-base leading-relaxed text-slate-700 sm:text-lg">
              {content.painBullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0c5290]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-lg font-medium text-slate-900">{content.painCloser}</p>
          </div>
        </section>

        <section className="bg-[#eaf2fb] px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[clamp(32px,4vw,48px)] font-light tracking-[-0.035em] text-[#0f172a]">{content.valueHeading}</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {content.values.map((item) => (
                <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-lg font-semibold text-[#0c5290]">{item.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0c5290_0%,#073157_55%,#061a2e_100%)] px-4 py-16 text-white sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(66,161,238,0.28),transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl text-center">
            <h2 className="text-balance text-[clamp(36px,5vw,64px)] font-light tracking-[-0.04em] sm:text-5xl">{content.closeHeading}</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-sky-100 sm:text-xl">{content.closeSubheading}</p>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-8 rounded-full bg-white px-8 py-4 text-base font-semibold text-[#052747] shadow-xl shadow-black/20 transition hover:opacity-95"
            >
              {content.cta}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function getLandingContent(kind: LandingKind): LandingContent {
  if (kind === "newCopy") {
    return {
      eyebrow: "For [Industry] Owners Doing £500K-£5M",
      heading:
        "Know Exactly What to Fix First in Your £500K-£5M Business in 12 Minutes",
      subheading:
        "The BOSS Dashboard scores your business across 5 levels and 10 areas using 50 red, yellow, green questions to give you one score out of 100, one focus area, and one clear next move.",
      cta: "Get My Free BOSS Score (12 Minutes, No Call Required)",
      heroStats: [
        { k: "12 mins", v: "to complete" },
        { k: "50 Qs", v: "across 10 areas" },
        { k: "£0", v: "no credit card" },
        { k: "1 score", v: "actionable focus" },
      ],
      painHeading: "If your business feels stuck, it's not effort, it's clarity.",
      painIntro:
        "You can see twenty things wrong with your business, but you cannot see which one will move the needle first.",
      painBullets: [
        "Do you feel like you're firefighting every day with no strategic progress?",
        "Are you working harder than ever while your revenue stays flat?",
        "Have you tried books, consultants, and courses but still do not know what to fix first?",
        "Do twenty visible issues in your business still stay trapped in your head with no order and no plan?",
      ],
      painCloser:
        "The BOSS Dashboard pulls that picture out of your head and shows you exactly what to fix first, no call, no pitch, no commitment.",
      valueHeading: "Why The BOSS Dashboard Is Different",
      values: [
        { title: "Score Out of 100", text: "Get one clear number so you know exactly where you stand." },
        { title: "5 Levels of Business", text: "See all five levels on one grid so you fix the right level first." },
        { title: "50 Red, Yellow, Green Questions", text: "Spot what is bleeding, what works, and what is nearly there." },
        { title: "Built on 25+ Business Thinkers", text: "Use one mapped diagnostic instead of disconnected frameworks." },
        { title: "Owner Performance First", text: "Fix root causes in the owner layer before treating symptoms." },
        { title: "Free and No Call Required", text: "Take the full diagnostic in 12 minutes and get your score immediately." },
      ],
      closeHeading: "Are You The BOSS Of Your Business, Or Is It The BOSS Of You?",
      closeSubheading:
        "Find out in 12 minutes. 50 questions. 10 areas. 5 levels. One score out of 100. One clear focus area.",
    };
  }

  return {
    eyebrow: "Business Operating System Diagnostic",
    heading: "Are You The BOSS, Or Is Your Business The BOSS Of You?",
    subheading:
      "Take a fast strategic assessment inspired by the BOSS design and get a clear score, a clear priority, and a clear next step in under 12 minutes.",
    cta: "Take The Free BOSS Assessment",
    heroStats: [
      { k: "12 mins", v: "to complete" },
      { k: "50 Qs", v: "across 10 areas" },
      { k: "£0", v: "no credit card" },
      { k: "1 page", v: "action plan" },
    ],
    painHeading: "Most owners are not missing effort, they are missing order.",
    painIntro:
      "When everything feels urgent, you patch symptoms, stay overworked, and never fix the core bottleneck.",
    painBullets: [
      "You are carrying too many roles and still not seeing strategic progress.",
      "You know there are leaks in sales, team, and delivery but no ranked order for what to fix.",
      "Your weeks are full, but the needle does not move enough.",
      "You need one clear view of your whole operating system, not more random advice.",
    ],
    painCloser: "This diagnostic gives you a practical map so you can stop guessing and start fixing the right thing first.",
    valueHeading: "What You Get From This Assessment",
    values: [
      { title: "A Single Score", text: "See where your operating system sits right now." },
      { title: "A Priority Area", text: "Know which area has the highest leverage." },
      { title: "A 5-Level View", text: "Understand your maturity level as an owner." },
      { title: "A 10-Area Breakdown", text: "Get clarity across the full business." },
      { title: "Action Focus", text: "Turn insight into an immediate next move." },
      { title: "Instant Result", text: "No waiting and no call required." },
    ],
    closeHeading: "Get The Clarity To Grow Profit And Buy Back Time",
    closeSubheading: "One diagnostic. One score. One focus. One next move.",
  };
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
  props: LandingVariantLegacyProps & { variant: "dark" | "light"; cta?: string }
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
    ? "rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl"
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
  const ctaLabel = props.cta ?? "Get my results";

  // Defer real inputs until after mount so password-manager extensions (e.g. LastPass)
  // cannot inject nodes into the SSR tree and break hydration.
  const [formMounted, setFormMounted] = useState(false);
  useEffect(() => {
    setFormMounted(true);
  }, []);

  if (!formMounted) {
    const skeletonBar = isDark ? "bg-white/10" : "bg-slate-100";
    return (
      <div id="landing-form" className="scroll-mt-24">
        <div className={cardClass}>
          <div className="space-y-5" aria-busy="true" aria-label="Loading form">
            <div className={`h-8 w-3/4 max-w-xs rounded-lg ${skeletonBar} animate-pulse`} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`h-14 rounded-xl ${skeletonBar} animate-pulse`} />
              <div className={`h-14 rounded-xl ${skeletonBar} animate-pulse`} />
            </div>
            <div className={`h-12 w-full rounded-full ${isDark ? "bg-white/15" : "bg-slate-200"} animate-pulse`} />
          </div>
        </div>
      </div>
    );
  }

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
                    name="given-name"
                    autoComplete="given-name"
                    data-lpignore="true"
                    data-1p-ignore
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
                    name="family-name"
                    autoComplete="family-name"
                    data-lpignore="true"
                    data-1p-ignore
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                    placeholder="Last name"
                  />
                </div>
              </div>
              {formError && <p className={`text-sm ${errorText}`} role="alert">{formError}</p>}
              <button type="submit" className={primaryBtn}>
                {ctaLabel}
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
                  name="email"
                  autoComplete="email"
                  data-lpignore="true"
                  data-1p-ignore
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. you@company.com"
                />
              </div>
              {formError && <p className={`text-sm ${errorText}`} role="alert">{formError}</p>}
              <button type="submit" className={primaryBtn}>
                {ctaLabel}
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
                  name="tel"
                  autoComplete="tel"
                  data-lpignore="true"
                  data-1p-ignore
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${inputClass} min-w-0 flex-1`}
                  placeholder="e.g. 7123 456789"
                />
              </div>
              {formError && <p className={`text-sm ${errorText}`} role="alert">{formError}</p>}
              <button type="submit" disabled={submitting} className={`${primaryBtn} disabled:opacity-70 disabled:cursor-wait`}>
                {submitting ? "Starting…" : ctaLabel}
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
