"use client";

const inputClass =
  "block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-[#2D2F46] outline-none placeholder:text-slate-400 focus:border-[#438BCA] focus:ring-1 focus:ring-[#438BCA]";

type ScorecardResultsContactStepProps = {
  firstName?: string | null;
  askPhone: boolean;
  email: string;
  phone: string;
  error?: string | null;
  submitting?: boolean;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
};

export function ScorecardResultsContactStep({
  firstName,
  askPhone,
  email,
  phone,
  error,
  submitting = false,
  onEmailChange,
  onPhoneChange,
  onSubmit,
}: ScorecardResultsContactStepProps) {
  const name = firstName?.trim();
  const heading = name
    ? `${name}, where should we send your results?`
    : "Where should we send your results?";

  return (
    <div className="rounded-3xl bg-white p-7 pb-8 shadow-xl ring-1 ring-slate-200 md:p-11 md:pb-12 lg:p-14 lg:pb-14">
      <h2 className="text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
        {heading}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate-600 md:text-lg">
        Enter your email and we&apos;ll send your score so you can keep it.
      </p>
      <form
        className="mt-6 space-y-5 md:mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
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
            autoFocus
            required
            maxLength={254}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={inputClass}
            placeholder="e.g. you@company.com"
          />
        </div>
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
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-[#0c5290] py-4 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-[#0a4580] disabled:opacity-50"
        >
          Show My Results
        </button>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
