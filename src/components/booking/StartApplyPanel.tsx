"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import {
  InvestmentPicker,
  RolePicker,
  TimingPicker,
} from "@/components/booking/QualifyChoices";
import { NativeBookingEmbed } from "@/components/booking/NativeBookingEmbed";
import {
  BCA_DISCOVERY_BOOKING_BASE,
  BCA_DISCOVERY_EMBED_SCRIPT,
} from "@/lib/bcaDiscoveryCalendar";
import {
  hasApplyPrefill,
  resolveBookCallPrefill,
  writeStoredBookCallPrefill,
  type ApplyPrefill,
} from "@/lib/booking/bookCallPrefill";
import { START_APPLY_FOCUS_EVENT } from "@/lib/booking/startApplyFocus";
import "./start-apply-panel.css";

export type { ApplyPrefill };

const BOOKING_BASE = BCA_DISCOVERY_BOOKING_BASE;
const EMBED_SCRIPT = BCA_DISCOVERY_EMBED_SCRIPT;
const LEAD_DEBOUNCE_MS = 20_000;

/** GHL iframe (default) vs native day/time picker after Let’s Talk unlock. */
export type StartApplyCalendarEngine =
  | { type: "ghl" }
  | { type: "native"; slug: string; calendarSlug?: string };

type LeadStage = "phone" | "name" | "email";
type LeadPayload = {
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  timing?: string;
  investment?: string;
  stage: LeadStage;
};

type Country = { code: string; dial: string; label: string };

const COUNTRIES: Country[] = [
  { code: "GB", dial: "44", label: "United Kingdom" },
  { code: "US", dial: "1", label: "United States" },
  { code: "IE", dial: "353", label: "Ireland" },
  { code: "AU", dial: "61", label: "Australia" },
  { code: "CA", dial: "1", label: "Canada" },
  { code: "NZ", dial: "64", label: "New Zealand" },
  { code: "ZA", dial: "27", label: "South Africa" },
  { code: "DE", dial: "49", label: "Germany" },
  { code: "FR", dial: "33", label: "France" },
  { code: "NL", dial: "31", label: "Netherlands" },
  { code: "ES", dial: "34", label: "Spain" },
  { code: "IT", dial: "39", label: "Italy" },
  { code: "AE", dial: "971", label: "United Arab Emirates" },
  { code: "SG", dial: "65", label: "Singapore" },
  { code: "IN", dial: "91", label: "India" },
];

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function findCountryByPrefix(value: string) {
  const digits = digitsOnly(value);
  const matches = COUNTRIES.filter((country) => digits.startsWith(country.dial));
  if (!matches.length) return null;
  return matches.sort((a, b) => b.dial.length - a.dial.length)[0];
}

function toE164(value: string, fallbackCountry: Country) {
  const digits = digitsOnly(value);
  if (!digits) return `+${fallbackCountry.dial}`;
  return `+${digits}`;
}

function getNationalPortion(value: string, country: Country) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith(country.dial)) return digits.slice(country.dial.length);
  return digits;
}

function formatPhoneDisplay(value: string, country: Country) {
  const digits = digitsOnly(value);
  if (!digits) return value.startsWith("+") ? "+ " : "";
  const dial = country.dial;
  const national = digits.startsWith(dial) ? digits.slice(dial.length) : digits;
  if (!national) return `+${dial} `;

  if (country.code === "GB") {
    const a = national.slice(0, 4);
    const b = national.slice(4);
    let out = `+${dial}`;
    if (a) out += `  ${a}`;
    if (b) out += `  ${b}`;
    return out;
  }

  if (country.code === "US" || country.code === "CA") {
    const a = national.slice(0, 3);
    const b = national.slice(3, 6);
    const c = national.slice(6, 10);
    const rest = national.slice(10);
    if (national.length <= 3) return `+${dial}  (${a}`;
    if (national.length <= 6) return `+${dial}  (${a})  ${b}`;
    return `+${dial}  (${a})  ${b}-${c}${rest}`;
  }

  const groups = national.match(/.{1,3}/g) ?? [];
  return `+${dial}  ${groups.join("  ")}`;
}

function leadFingerprint(payload: LeadPayload) {
  return JSON.stringify({
    phone: payload.phone,
    firstName: payload.firstName ?? "",
    lastName: payload.lastName ?? "",
    email: payload.email ?? "",
    role: payload.role ?? "",
    timing: payload.timing ?? "",
    investment: payload.investment ?? "",
    stage: payload.stage,
  });
}

function postLead(payload: LeadPayload, enabled: boolean) {
  if (!enabled) return;
  void fetch("/api/leads/book-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[StartApplyPanel] lead send failed", err);
  });
}

function buildBookingSrc(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}) {
  const params = new URLSearchParams({
    first_name: data.firstName,
    last_name: data.lastName,
    name: `${data.firstName} ${data.lastName}`.trim(),
    email: data.email,
    phone: data.phone,
  });
  return `${BOOKING_BASE}?${params.toString()}`;
}

/** Decorative month grid for the locked calendar panel. */
function CalendarPreview() {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - 2;
    if (day < 1 || day > 31) return null;
    return day;
  });

  return (
    <div className="start-panel__cal" aria-hidden="true">
      <div className="start-panel__cal-head">
        <span>July 2026</span>
        <span className="start-panel__cal-nav">‹  ›</span>
      </div>
      <div className="start-panel__cal-days">
        {days.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="start-panel__cal-grid">
        {cells.map((day, i) => (
          <span
            key={i}
            className={
              day === 30 ? "is-pick" : day === 31 ? "is-soft" : day ? undefined : "is-empty"
            }
          >
            {day ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function phoneSeedFromPrefill(phoneRaw?: string) {
  if (!phoneRaw?.trim()) {
    return { countryCode: "GB", phoneValue: "+44 " };
  }
  const digits = digitsOnly(phoneRaw);
  const matched = findCountryByPrefix(digits) ?? COUNTRIES[0];
  const withDial = digits.startsWith(matched.dial)
    ? digits
    : `${matched.dial}${digits}`;
  return {
    countryCode: matched.code,
    phoneValue: formatPhoneDisplay(`+${withDial}`, matched),
  };
}

function seedFromPrefill(prefill?: ApplyPrefill) {
  const phone = phoneSeedFromPrefill(prefill?.phone);
  return {
    ...phone,
    firstName: prefill?.firstName?.trim() ?? "",
    lastName: prefill?.lastName?.trim() ?? "",
    email: prefill?.email?.trim() ?? "",
    role: prefill?.role ?? "",
    timing: prefill?.timing ?? "",
    investment: prefill?.investment ?? "",
  };
}

type Props = {
  /**
   * `page` — VSL landing under the video (`#apply`).
   * `modal` — site-wide book-call popup + `/bookacall` (no “watch video” step).
   */
  variant?: "page" | "modal";
  /** Modal chrome can hide its title once the calendar unlocks. */
  onCalendarChange?: (showing: boolean) => void;
  /**
   * Optional prefill (server-parsed URL, email merge tags, etc.).
   * Client also merges sessionStorage + current URL so details survive browsing.
   */
  prefill?: ApplyPrefill;
  /**
   * When true, debounced contact + qualify answers POST to `/api/leads/book-call`.
   * Keep false for staff previews until that webhook is wired.
   */
  enableLeadCapture?: boolean;
  /** Override terms / privacy hrefs (defaults to BCA marketing site). */
  termsHref?: string;
  privacyHref?: string;
  /**
   * After Continue: GHL Fit Call iframe (default) or native booking embed.
   * Use `StartApplyPanelNative` for the native coach-slug flow.
   */
  calendar?: StartApplyCalendarEngine;
};

/**
 * Let’s Talk apply panel — phone + name first, then email + qualify expand,
 * then Continue unlocks the calendar (GHL iframe by default; native when `calendar.type === "native"`).
 * URL / session prefill fills the form; user still taps Continue to unlock the calendar.
 */
export function StartApplyPanel({
  variant = "page",
  onCalendarChange,
  prefill: prefillProp,
  enableLeadCapture = false,
  termsHref = "https://www.businesscoachacademy.com/terms-and-conditions",
  privacyHref = "https://www.businesscoachacademy.com/privacy-policy",
  calendar = { type: "ghl" },
}: Props) {
  const seeded = seedFromPrefill(prefillProp);
  const [countryCode, setCountryCode] = useState(seeded.countryCode);
  const [phoneValue, setPhoneValue] = useState(seeded.phoneValue);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [firstName, setFirstName] = useState(seeded.firstName);
  const [lastName, setLastName] = useState(seeded.lastName);
  const [email, setEmail] = useState(seeded.email);
  const [role, setRole] = useState(seeded.role);
  const [timing, setTiming] = useState(seeded.timing);
  const [investment, setInvestment] = useState(seeded.investment);
  const [bookingEmail, setBookingEmail] = useState(seeded.email);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"form" | "calendar">("form");
  const [phoneHighlight, setPhoneHighlight] = useState(false);
  const uid = useId().replace(/:/g, "");
  const phoneRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const countryMenuRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const leadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLeadRef = useRef<LeadPayload | null>(null);
  const lastSentLeadRef = useRef("");
  const didExpandFocus = useRef(false);
  const didApplyStoredPrefill = useRef(false);
  const onCalendarChangeRef = useRef(onCalendarChange);
  onCalendarChangeRef.current = onCalendarChange;
  const enableLeadCaptureRef = useRef(enableLeadCapture);
  enableLeadCaptureRef.current = enableLeadCapture;
  const isModal = variant === "modal";

  // Resolve session store + URL + prop once (modal / page / any host).
  useEffect(() => {
    if (didApplyStoredPrefill.current) return;
    didApplyStoredPrefill.current = true;
    const next = resolveBookCallPrefill(prefillProp);
    if (!hasApplyPrefill(next)) return;

    const seed = seedFromPrefill(next);
    setCountryCode(seed.countryCode);
    setPhoneValue(seed.phoneValue);
    setFirstName(seed.firstName);
    setLastName(seed.lastName);
    setEmail(seed.email);
    setRole(seed.role);
    setTiming(seed.timing);
    setInvestment(seed.investment);
    setBookingEmail(seed.email);
  }, [prefillProp]);

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
  const phoneE164 = toE164(phoneValue, country);
  const national = getNationalPortion(phoneValue, country);
  const phoneValid = national.length >= 7;

  // Keep the tab store fresh as they type (so another form later stays filled).
  // Only write fields that look real — never overwrite a saved phone with "+44 ".
  useEffect(() => {
    writeStoredBookCallPrefill({
      phone: phoneValid ? phoneE164 : undefined,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      email: email.trim() || undefined,
      role: role || undefined,
      timing: timing || undefined,
      investment: investment || undefined,
    });
  }, [phoneValid, phoneE164, firstName, lastName, email, role, timing, investment]);

  // Expand as soon as last name has a character, or once phone + both names look ready,
  // or when any later field is already prefilled.
  const expanded =
    lastName.trim().length >= 1 ||
    (phoneValid && firstName.trim().length > 0 && lastName.trim().length > 0) ||
    Boolean(email.trim() || role || timing || investment);
  const showCalendar = stage === "calendar";
  const isNative = calendar.type === "native";
  const nativeSlug = calendar.type === "native" ? calendar.slug : "";
  const nativeCalendarSlug =
    calendar.type === "native" ? calendar.calendarSlug ?? "discovery" : "discovery";
  // GHL iframe only — native mounts after Continue (no preload / no duplicate chrome).
  const preloadCalendar = !isNative && (expanded || showCalendar);

  const bookingSrc = buildBookingSrc({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: bookingEmail,
    phone: phoneE164,
  });

  const ids = {
    phone: `start-phone-${uid}`,
    first: `start-first-${uid}`,
    last: `start-last-${uid}`,
    email: `start-email-${uid}`,
    role: `start-role-${uid}`,
    timing: `start-timing-${uid}`,
    investment: `start-investment-${uid}`,
    iframe: `start-booking-${uid}`,
  };

  useEffect(() => {
    onCalendarChangeRef.current?.(showCalendar);
  }, [showCalendar]);

  useEffect(() => {
    if (!isModal) return;
    if (stage === "calendar") return;
    setPhoneHighlight(true);

    function focusPhoneField() {
      const input = phoneRef.current;
      if (!input) return false;
      input.focus({ preventScroll: true });
      const end = input.value.length;
      try {
        input.setSelectionRange(end, end);
      } catch {
        /* some browsers reject setSelectionRange on tel */
      }
      return document.activeElement === input;
    }

    // Portal + exit headline paint after the first frame — retry briefly.
    const t1 = window.setTimeout(focusPhoneField, 50);
    const t2 = window.setTimeout(focusPhoneField, 180);
    const t3 = window.setTimeout(focusPhoneField, 400);
    const clearTimer = window.setTimeout(() => setPhoneHighlight(false), 3200);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(clearTimer);
    };
  }, [isModal, stage]);

  useEffect(() => {
    if (!countryMenuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!countryMenuRef.current?.contains(event.target as Node)) {
        setCountryMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [countryMenuOpen]);

  useEffect(() => {
    if (isModal) return;

    function focusPhone() {
      if (stage === "calendar") return;
      setPhoneHighlight(true);
      window.setTimeout(() => {
        const input = phoneRef.current;
        if (!input) return;
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }, 420);
      window.setTimeout(() => setPhoneHighlight(false), 2600);
    }

    function onFocusEvent() {
      focusPhone();
    }

    function onHash() {
      if (window.location.hash === "#apply") focusPhone();
    }

    window.addEventListener(START_APPLY_FOCUS_EVENT, onFocusEvent);
    window.addEventListener("hashchange", onHash);
    if (window.location.hash === "#apply") focusPhone();
    return () => {
      window.removeEventListener(START_APPLY_FOCUS_EVENT, onFocusEvent);
      window.removeEventListener("hashchange", onHash);
    };
  }, [stage, isModal]);

  useEffect(() => {
    if (expanded && !didExpandFocus.current) {
      didExpandFocus.current = true;
      // Don’t steal focus when the form arrived already filled from the URL.
      if (!email.trim()) {
        requestAnimationFrame(() => emailRef.current?.focus());
      }
    }
    if (!expanded) didExpandFocus.current = false;
  }, [expanded, email]);

  useEffect(() => {
    if (showCalendar) {
      setBookingEmail(email.trim());
      return;
    }
    if (!expanded) return;
    const timer = window.setTimeout(() => setBookingEmail(email.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [email, expanded, showCalendar]);

  // After reveal, nudge High Level to recount iframe height (preload can leave it short).
  useEffect(() => {
    if (isNative || !showCalendar) return;
    const iframe = document.getElementById(ids.iframe) as HTMLIFrameElement | null;
    if (!iframe) return;

    function nudge() {
      window.dispatchEvent(new Event("resize"));
      if (!iframe) return;
      const current = parseInt(iframe.style.height || "0", 10) || iframe.offsetHeight;
      if (current < 680) {
        iframe.style.height = "720px";
      }
    }

    const t1 = window.setTimeout(nudge, 80);
    const t2 = window.setTimeout(nudge, 450);
    const t3 = window.setTimeout(nudge, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isNative, showCalendar, ids.iframe]);

  function clearLeadTimer() {
    if (leadTimerRef.current) {
      clearTimeout(leadTimerRef.current);
      leadTimerRef.current = null;
    }
  }

  function queueLeadSend(payload: LeadPayload, immediate = false) {
    pendingLeadRef.current = payload;
    clearLeadTimer();
    const send = () => {
      leadTimerRef.current = null;
      const pending = pendingLeadRef.current;
      pendingLeadRef.current = null;
      if (!pending) return;
      const fingerprint = leadFingerprint(pending);
      if (fingerprint === lastSentLeadRef.current) return;
      lastSentLeadRef.current = fingerprint;
      postLead(pending, enableLeadCaptureRef.current);
    };
    if (immediate) {
      send();
      return;
    }
    leadTimerRef.current = setTimeout(send, LEAD_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (!leadTimerRef.current) return;
      clearTimeout(leadTimerRef.current);
      leadTimerRef.current = null;
      const pending = pendingLeadRef.current;
      pendingLeadRef.current = null;
      if (!pending) return;
      const fingerprint = leadFingerprint(pending);
      if (fingerprint === lastSentLeadRef.current) return;
      lastSentLeadRef.current = fingerprint;
      postLead(pending, enableLeadCaptureRef.current);
    };
  }, []);

  // Debounced lead as soon as phone + name look complete
  useEffect(() => {
    if (!phoneValid || !firstName.trim() || !lastName.trim()) return;
    queueLeadSend({
      phone: phoneE164,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      stage: "name",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional on field settle
  }, [phoneValid, firstName, lastName, phoneE164]);

  function updateCountry(nextCountry: Country) {
    const localNumber = getNationalPortion(phoneValue, country);
    setCountryCode(nextCountry.code);
    setPhoneValue(formatPhoneDisplay(`+${nextCountry.dial}${localNumber}`, nextCountry));
    setCountryMenuOpen(false);
    requestAnimationFrame(() => {
      const input = phoneRef.current;
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  function handlePhoneChange(nextValue: string) {
    const digits = digitsOnly(nextValue);
    if (!digits) {
      setPhoneValue(nextValue.includes("+") ? "+" : "");
      return;
    }
    const matchedCountry = findCountryByPrefix(digits) ?? country;
    if (matchedCountry.code !== countryCode) setCountryCode(matchedCountry.code);
    const withDial = digits.startsWith(matchedCountry.dial)
      ? digits
      : `${matchedCountry.dial}${digits}`;
    setPhoneValue(formatPhoneDisplay(`+${withDial}`, matchedCountry));
  }

  function onContinue(e: FormEvent) {
    e.preventDefault();
    if (!phoneValid) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter your first and last name.");
      return;
    }
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!role) {
      setError("Select which best describes you.");
      return;
    }
    if (!timing) {
      setError("Select whether you’re able to get started in the next 90 days.");
      return;
    }
    if (!investment) {
      setError("Select whether the investment works for you.");
      return;
    }
    setEmail(trimmed);
    setError("");
    queueLeadSend(
      {
        phone: phoneE164,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmed,
        role,
        timing,
        investment,
        stage: "email",
      },
      true,
    );
    setStage("calendar");
  }

  return (
    <div
      ref={panelRef}
      className={`start-panel${isModal ? " start-panel--modal" : ""}${
        showCalendar ? " start-panel--calendar" : ""
      }${expanded ? " start-panel--expanded" : ""}${
        phoneHighlight && !phoneValid ? " start-panel--phone-focus" : ""
      }`}
      id={isModal ? undefined : "apply"}
    >
      <div className="start-panel__steps" aria-label="Application steps">
        {!isModal ? (
          <span className="start-panel__step is-done">
            <i aria-hidden="true">1</i>
            Watch the video
          </span>
        ) : null}
        {showCalendar ? (
          <button
            type="button"
            className="start-panel__step is-done start-panel__step--back"
            onClick={() => setStage("form")}
          >
            <i aria-hidden="true">{isModal ? "1" : "2"}</i>
            Fill out the form
          </button>
        ) : (
          <span className="start-panel__step is-on">
            <i aria-hidden="true">{isModal ? "1" : "2"}</i>
            Fill out the form
          </span>
        )}
        <span className={`start-panel__step${showCalendar ? " is-on" : ""}`}>
          <i aria-hidden="true">{isModal ? "2" : "3"}</i>
          Book your call
        </span>
      </div>

      {!showCalendar ? (
        <div className="start-panel__split">
          <form className="start-panel__form" onSubmit={onContinue} noValidate>
            <h2 className="start-panel__title">Let&apos;s Talk</h2>
            <p className="start-panel__lead">
              Ready to see if the Academy is the right next step?
            </p>

            <div>
              <div
                className={`start-panel__phone${phoneValid ? "" : " start-panel__phone--pulse"}`}
              >
                <div className="start-panel__phone-country" ref={countryMenuRef}>
                  <button
                    type="button"
                    className="start-panel__phone-trigger"
                    aria-expanded={countryMenuOpen}
                    aria-haspopup="listbox"
                    aria-label={`Country code, currently ${country.label} plus ${country.dial}`}
                    onClick={() => setCountryMenuOpen((open) => !open)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="start-panel__phone-flag"
                      src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                      alt=""
                      width={22}
                      height={16}
                      loading="lazy"
                    />
                    <span className="start-panel__phone-caret" aria-hidden="true" />
                  </button>
                  {countryMenuOpen ? (
                    <div className="start-panel__country-menu" role="listbox" aria-label="Country codes">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          className={`start-panel__country-option${
                            c.code === countryCode ? " is-active" : ""
                          }`}
                          onClick={() => updateCountry(c)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                            alt=""
                            width={22}
                            height={16}
                            loading="lazy"
                          />
                          <span className="start-panel__country-label">{c.label}</span>
                          <span className="start-panel__country-dial">+{c.dial}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="start-panel__phone-divider" aria-hidden="true" />
                <input
                  ref={phoneRef}
                  id={ids.phone}
                  className="start-panel__phone-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-label="Phone number"
                  placeholder={`+${country.dial}`}
                  value={phoneValue}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="start-panel__name-row">
              <div>
                <input
                  id={ids.first}
                  className="start-panel__input"
                  type="text"
                  autoComplete="given-name"
                  aria-label="First name"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <input
                  id={ids.last}
                  className="start-panel__input"
                  type="text"
                  autoComplete="family-name"
                  aria-label="Last name"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            {expanded ? (
              <div className="start-panel__more">
                <div className="start-panel__field">
                  <label className="start-panel__label" htmlFor={ids.email}>
                    Email address
                    <span className="start-panel__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    ref={emailRef}
                    id={ids.email}
                    className="start-panel__input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="start-panel__field">
                  <p className="start-panel__label" id={ids.role}>
                    Which best describes you?
                    <span className="start-panel__req" aria-hidden="true">
                      *
                    </span>
                  </p>
                  <RolePicker value={role} onChange={setRole} compact />
                </div>

                <div className="start-panel__field">
                  <p className="start-panel__label" id={ids.timing}>
                    Able to get started in the next 90 days?
                    <span className="start-panel__req" aria-hidden="true">
                      *
                    </span>
                  </p>
                  <TimingPicker value={timing} onChange={setTiming} compact />
                </div>

                <div className="start-panel__field">
                  <p className="start-panel__label" id={ids.investment}>
                    This requires an investment. Does that work for you?
                    <span className="start-panel__req" aria-hidden="true">
                      *
                    </span>
                  </p>
                  <InvestmentPicker value={investment} onChange={setInvestment} compact />
                </div>
              </div>
            ) : null}

            {error ? <p className="start-panel__error">{error}</p> : null}

            <p className="start-panel__consent">
              By entering your information, you consent to your data being saved in accordance with
              our{" "}
              <a href={termsHref} target="_blank" rel="noreferrer">
                Terms
              </a>{" "}
              &amp;{" "}
              <a href={privacyHref} target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </p>

            <button type="submit" className="start-panel__continue" disabled={!expanded}>
              Continue <span aria-hidden="true">›</span>
            </button>
          </form>

          <div className="start-panel__aside">
            <CalendarPreview />
            <div className="start-panel__lock">
              <p>Please fill out the form before choosing your time slot.</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Native picker — shown only after Continue (header lives inside NativeBookingEmbed). */}
      {isNative && showCalendar ? (
        <div className="start-panel__booking">
          <div className="start-panel__native">
            <NativeBookingEmbed
              slug={nativeSlug}
              calendarSlug={nativeCalendarSlug}
              embedded
              contact={{
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: bookingEmail.trim() || email.trim(),
                phone: phoneE164,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Keep the GHL iframe mounted from expand → Continue so it doesn’t remount on reveal. */}
      {preloadCalendar ? (
        <div
          className={`start-panel__booking${
            showCalendar ? "" : " start-panel__booking--preload"
          }`}
          aria-hidden={!showCalendar}
        >
          {showCalendar ? (
            <div className="start-panel__booking-intro">
              <h2 className="start-panel__title">
                {firstName.trim()
                  ? `Thanks ${firstName.trim()} — pick a time`
                  : "Pick a time"}
              </h2>
              <p className="start-panel__lead">
                15-Minute Fit Call · Zoom · No pressure
              </p>
            </div>
          ) : null}
          <div className="start-panel__embed">
            <iframe
              src={bookingSrc}
              title="Book a 15-Minute Fit Call"
              allow="payment"
              scrolling={showCalendar ? "yes" : "no"}
              id={ids.iframe}
              tabIndex={showCalendar ? undefined : -1}
            />
          </div>
          <Script src={EMBED_SCRIPT} strategy="afterInteractive" />
        </div>
      ) : null}
    </div>
  );
}
