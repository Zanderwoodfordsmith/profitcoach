"use client";

import { useEffect, useRef } from "react";

const inputClass =
  "block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-[#2D2F46] outline-none placeholder:text-slate-400 focus:border-[#438BCA] focus:ring-1 focus:ring-[#438BCA]";

type ScorecardResultsContactStepProps = {
  firstName?: string | null;
  askName: boolean;
  askEmail: boolean;
  askPhone: boolean;
  fullName: string;
  email: string;
  phone: string;
  error?: string | null;
  submitting?: boolean;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
};

export function ScorecardResultsContactStep({
  firstName,
  askName,
  askEmail,
  askPhone,
  fullName,
  email,
  phone,
  error,
  submitting = false,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
  onSubmit,
}: ScorecardResultsContactStepProps) {
  const errorRef = useRef<HTMLParagraphElement>(null);
  const name = firstName?.trim();
  const heading =
    askName && !askEmail
      ? "What's your name?"
      : name && !askName
        ? `${name}, where should we send your results?`
        : "Where should we send your results?";
  const support =
    askName && askEmail
      ? askPhone
        ? "Add your name and email so your coach knows this score is yours. Phone is optional."
        : "Add your name and email so your coach knows this score is yours."
      : askName
        ? "Add your name so your coach knows this score is yours."
        : askPhone
          ? "Enter your email and we'll send your score so you can keep it. Phone is optional."
          : "Enter your email and we'll send your score so you can keep it.";

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  return (
    <div className="rounded-3xl bg-white p-7 pb-8 shadow-xl ring-1 ring-slate-200 md:p-11 md:pb-12 lg:p-14 lg:pb-14">
      <h2 className="text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
        {heading}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate-600 md:text-lg">
        {support}
      </p>
      <form
        className="mt-6 space-y-5 md:mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {askName ? (
          <div>
            <label
              htmlFor="results-contact-name"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Name
            </label>
            <input
              id="results-contact-name"
              type="text"
              name="name"
              autoComplete="name"
              autoFocus
              required
              maxLength={120}
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              className={inputClass}
              placeholder="e.g. Alex Morgan"
            />
          </div>
        ) : null}
        {askEmail ? (
          <div>
            <label
              htmlFor="results-contact-email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="results-contact-email"
              type="email"
              name="email"
              autoComplete="email"
              autoFocus={!askName}
              required
              maxLength={254}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className={inputClass}
              placeholder="e.g. you@company.com"
            />
          </div>
        ) : null}
        {askPhone ? (
          <div>
            <label
              htmlFor="results-contact-phone"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Phone{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="results-contact-phone"
              type="tel"
              name="tel"
              autoComplete="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className={inputClass}
              placeholder="e.g. 07123 456789"
            />
          </div>
        ) : null}
        {error ? (
          <p ref={errorRef} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-[#0c5290] py-4 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#0a4580] disabled:opacity-50"
        >
          Show My Results
        </button>
      </form>
    </div>
  );
}
