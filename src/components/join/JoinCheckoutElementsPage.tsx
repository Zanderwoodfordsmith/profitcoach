"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";

import {
  PROGRAMME_JOIN_OFFERS,
  type ProgrammeJoinOffer,
} from "@/config/programmeJoinOffers";

type Contact = {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  postalCode: string;
};

const COUNTRIES = [
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "US", label: "United States" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "NZ", label: "New Zealand" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
] as const;

const inputClassName =
  "block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/20";

function getStripe(publishableKey: string) {
  const cache = getStripe as unknown as {
    _promises?: Map<string, Promise<Stripe | null>>;
  };
  if (!cache._promises) cache._promises = new Map();
  let promise = cache._promises.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    cache._promises.set(publishableKey, promise);
  }
  return promise;
}

const summaryPanelClassName =
  "bg-[linear-gradient(165deg,#0a4478_0%,#0c5290_48%,#1578a8_100%)] text-white";

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 3l7 3v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 10V7a4 4 0 018 0v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrustMarks({ tone }: { tone: "light" | "dark" }) {
  const iconWrap =
    tone === "dark"
      ? "bg-white/15 text-white"
      : "bg-slate-100 text-[#0c5290]";
  const label = tone === "dark" ? "text-white/85" : "text-slate-500";

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] ${label}`}>
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${iconWrap}`}
        >
          <ShieldIcon className="h-3.5 w-3.5" />
        </span>
        Secure checkout
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${iconWrap}`}
        >
          <LockIcon className="h-3.5 w-3.5" />
        </span>
        Encrypted by Stripe
      </span>
    </div>
  );
}

function OrderSummaryPanel({ offer }: { offer: ProgrammeJoinOffer }) {
  const hasFuture = Boolean(offer.futurePaymentsDetail);

  return (
    <aside className={`flex h-full flex-col ${summaryPanelClassName}`}>
      <div className="flex flex-1 flex-col px-8 py-10 lg:px-11 lg:py-12">
        <Image
          src="/profit-coach-logo.svg"
          alt="Profit Coach"
          width={200}
          height={56}
          className="mb-8 h-auto w-[148px] brightness-0 invert"
          priority
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          Order summary
        </p>
        <h2 className="mt-2 text-balance text-[1.625rem] font-semibold tracking-tight">
          {offer.headline}
        </h2>
        <p className="mt-1 text-sm text-white/70">{offer.title}</p>

        <div className="mt-7 space-y-4 border-t border-white/15 pt-5 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-white">Today&apos;s payment</p>
              <p className="mt-0.5 text-[13px] text-white/65">{offer.headline}</p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {offer.todayAmountLabel}
            </p>
          </div>

          {hasFuture ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-white">Future payments</p>
                <p className="mt-0.5 text-[13px] text-white/65">
                  {offer.futurePaymentsDetail}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {offer.todayAmountLabel}
              </p>
            </div>
          ) : null}
        </div>

        {offer.scheduleNote ? (
          <p className="mt-5 text-[13px] leading-snug text-white/65">
            {offer.scheduleNote}
          </p>
        ) : null}

        <div className="mt-auto pt-10">
          <TrustMarks tone="dark" />
        </div>
      </div>
    </aside>
  );
}

function MobileOrderSummary({ offer }: { offer: ProgrammeJoinOffer }) {
  return (
    <div className={`rounded-2xl px-5 py-4 ${summaryPanelClassName} lg:hidden`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            {offer.title}
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight">
            {offer.headline}
          </p>
        </div>
        <p className="shrink-0 text-xl font-semibold tabular-nums">
          {offer.todayAmountLabel}
        </p>
      </div>
      {offer.futurePaymentsDetail ? (
        <p className="mt-2 text-[13px] text-white/70">
          Future: {offer.futurePaymentsDetail} · {offer.todayAmountLabel}
        </p>
      ) : null}
      {offer.scheduleNote ? (
        <p className="mt-1.5 text-[13px] leading-snug text-white/65">
          {offer.scheduleNote}
        </p>
      ) : null}
    </div>
  );
}

function CheckoutForm({
  offer,
  contact,
  setContact,
}: {
  offer: ProgrammeJoinOffer;
  contact: Contact;
  setContact: React.Dispatch<React.SetStateAction<Contact>>;
}) {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expressVisible, setExpressVisible] = useState(false);

  async function applyBillingAddress() {
    if (checkoutState.type !== "success") return { ok: false as const };
    const fullName = [contact.firstName, contact.lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    const addressResult = await checkoutState.checkout.updateBillingAddress({
      name: fullName || contact.email,
      address: {
        country: contact.country.trim(),
        postal_code: contact.postalCode.trim(),
      },
    });
    if (addressResult.type === "error") {
      return { ok: false as const, message: addressResult.error.message };
    }
    return { ok: true as const };
  }

  async function handleExpressConfirm() {
    if (checkoutState.type !== "success") return;
    setBusy(true);
    setError(null);
    try {
      const email = contact.email.trim().toLowerCase();
      const confirmResult = await checkoutState.checkout.confirm(
        email.includes("@") ? { email } : undefined
      );
      if (confirmResult.type === "error") {
        setError(confirmResult.error.message);
        setBusy(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment could not be completed."
      );
      setBusy(false);
    }
  }

  async function handlePay(event: React.FormEvent) {
    event.preventDefault();
    if (checkoutState.type !== "success") return;

    const email = contact.email.trim().toLowerCase();
    if (!contact.firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!contact.country.trim()) {
      setError("Please select your country.");
      return;
    }
    if (!contact.postalCode.trim()) {
      setError("Please enter your postcode.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const address = await applyBillingAddress();
      if (!address.ok) {
        setError(address.message ?? "Could not save billing address.");
        setBusy(false);
        return;
      }

      const confirmResult = await checkoutState.checkout.confirm({ email });

      if (confirmResult.type === "error") {
        setError(confirmResult.error.message);
        setBusy(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment could not be completed."
      );
      setBusy(false);
    }
  }

  if (checkoutState.type === "loading") {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        Loading secure checkout…
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {checkoutState.error.message}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handlePay(e)} className="space-y-7">
      <section>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.375rem]">
          Contact details
        </h1>
        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">
              First name
            </span>
            <input
              required
              autoComplete="given-name"
              value={contact.firstName}
              onChange={(e) =>
                setContact((c) => ({ ...c, firstName: e.target.value }))
              }
              className={inputClassName}
              placeholder="First name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">
              Last name
            </span>
            <input
              autoComplete="family-name"
              value={contact.lastName}
              onChange={(e) =>
                setContact((c) => ({ ...c, lastName: e.target.value }))
              }
              className={inputClassName}
              placeholder="Last name"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">
              Email
            </span>
            <input
              required
              type="email"
              autoComplete="email"
              value={contact.email}
              onChange={(e) =>
                setContact((c) => ({ ...c, email: e.target.value }))
              }
              className={inputClassName}
              placeholder="you@example.com"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.375rem]">
          Payment details
        </h2>
        <div className="mt-3.5">
          <ExpressCheckoutElement
            options={{
              buttonHeight: undefined,
              buttonTheme: undefined,
              buttonType: undefined,
              layout: undefined,
              paymentMethodOrder: ["applePay", "googlePay", "paypal"],
              paymentMethods: {
                applePay: "always",
                paypal: "auto",
                googlePay: "auto",
                link: "never",
              },
            }}
            onReady={(event) => {
              const methods = event.availablePaymentMethods;
              setExpressVisible(
                Boolean(
                  methods &&
                    (methods.applePay || methods.paypal || methods.googlePay)
                )
              );
            }}
            onConfirm={() => {
              void handleExpressConfirm();
            }}
          />
          {expressVisible ? (
            <p className="my-3 text-center text-[12px] text-slate-400">
              or pay with card
            </p>
          ) : null}
          <PaymentElement
            options={{
              layout: {
                type: "accordion",
                defaultCollapsed: false,
                radios: "auto",
                spacedAccordionItems: true,
              },
              wallets: {
                // Link stays available as a collapsible method (not a huge Express button).
                link: "auto",
                applePay: "never",
                googlePay: "never",
              },
              paymentMethodOrder: ["card", "link", "paypal"],
              terms: { card: "never", applePay: "never", googlePay: "never" },
              fields: {
                billingDetails: {
                  name: "never",
                  email: "never",
                  phone: "never",
                  address: "never",
                },
              },
            }}
          />
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-700">
                Country
              </span>
              <select
                required
                value={contact.country}
                onChange={(e) =>
                  setContact((c) => ({ ...c, country: e.target.value }))
                }
                className={inputClassName}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-700">
                Postcode
              </span>
              <input
                required
                autoComplete="postal-code"
                value={contact.postalCode}
                onChange={(e) =>
                  setContact((c) => ({ ...c, postalCode: e.target.value }))
                }
                className={inputClassName}
                placeholder="Postcode"
              />
            </label>
          </div>
        </div>
      </section>

      {error ? (
        <p
          className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2.5">
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center rounded-xl bg-[#0c5290] px-6 py-3.5 text-[16px] font-semibold text-white shadow-sm transition hover:bg-[#0a4478] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Processing…" : offer.ctaLabel}
        </button>
        <div className="flex justify-center">
          <TrustMarks tone="light" />
        </div>
      </div>
    </form>
  );
}

export function JoinCheckoutElementsPage({
  offer,
  publishableKey,
}: {
  offer: ProgrammeJoinOffer;
  publishableKey: string;
}) {
  const [contact, setContact] = useState<Contact>({
    firstName: "",
    lastName: "",
    email: "",
    country: "GB",
    postalCode: "",
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stripePromise = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey]
  );

  useEffect(() => {
    if (!publishableKey) return;

    let cancelled = false;
    setClientSecret(null);
    setLoadError(null);

    (async () => {
      try {
        const res = await fetch("/api/join/checkout/elements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offer: offer.slug }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          clientSecret?: string;
          error?: string;
        };
        if (!res.ok || !body.clientSecret) {
          throw new Error(body.error ?? "Could not start checkout.");
        }
        if (!cancelled) setClientSecret(body.clientSecret);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not start checkout."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offer.slug, publishableKey]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] lg:grid lg:min-h-screen lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.05fr)]">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <OrderSummaryPanel offer={offer} />
        </div>
      </div>

      <div className="relative flex flex-col">
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <div className="mb-5 flex justify-center sm:mb-6 lg:hidden">
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={200}
              height={56}
              className="h-auto w-[132px] sm:w-[148px]"
              priority
            />
          </div>

          <MobileOrderSummary offer={offer} />

          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:mt-6 sm:p-6 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            {!publishableKey ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Add{" "}
                <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                </code>{" "}
                to continue.
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {loadError}
              </div>
            ) : clientSecret && stripePromise ? (
              <CheckoutElementsProvider
                key={clientSecret}
                stripe={stripePromise}
                options={{
                  clientSecret,
                  elementsOptions: {
                    appearance: {
                      theme: "stripe",
                      variables: {
                        colorPrimary: "#0c5290",
                        colorText: "#0f172a",
                        colorTextPlaceholder: "#94a3b8",
                        borderRadius: "8px",
                        fontFamily:
                          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
                      },
                      rules: {
                        ".Input": {
                          border: "1px solid #e2e8f0",
                          boxShadow: "none",
                          padding: "12px 14px",
                        },
                        ".Input:focus": {
                          border: "1px solid #0c5290",
                          boxShadow: "0 0 0 2px rgba(12, 82, 144, 0.2)",
                        },
                        ".Tab": {
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        },
                        ".Tab--selected": {
                          backgroundColor: "#0c5290",
                          borderColor: "#0c5290",
                          color: "#ffffff",
                        },
                        ".TabIcon--selected": {
                          fill: "#ffffff",
                        },
                        ".Label": {
                          fontWeight: "500",
                          color: "#334155",
                        },
                      },
                    },
                  },
                }}
              >
                <CheckoutForm
                  offer={offer}
                  contact={contact}
                  setContact={setContact}
                />
              </CheckoutElementsProvider>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">
                Loading secure checkout…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use JoinCheckoutElementsPage with a fixed offer. */
export function JoinTwoPayElementsPage({
  publishableKey,
}: {
  publishableKey: string;
}) {
  return (
    <JoinCheckoutElementsPage
      offer={PROGRAMME_JOIN_OFFERS["two-pay"]}
      publishableKey={publishableKey}
    />
  );
}
