"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

import type { ProgrammeJoinOffer } from "@/config/programmeJoinOffers";

type Props = {
  offer: ProgrammeJoinOffer;
  publishableKey: string;
};

const summaryPanelClassName =
  "bg-[linear-gradient(165deg,#0a4478_0%,#0c5290_48%,#1578a8_100%)] text-white";

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
    tone === "dark" ? "bg-white/15 text-white" : "bg-slate-100 text-[#0c5290]";
  const label = tone === "dark" ? "text-white/85" : "text-slate-500";

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] ${label}`}
    >
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

/**
 * Hybrid checkout: branded order summary (left) + Stripe Embedded Checkout (right).
 * Stripe owns wallets / Link / card UI; we own plan schedule clarity.
 */
export function JoinHybridCheckoutPage({ offer, publishableKey }: Props) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/join/checkout/embedded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer: offer.slug }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      clientSecret?: string;
      error?: string;
    };
    if (!res.ok || !body.clientSecret) {
      const message = body.error ?? "Could not start secure checkout.";
      setError(message);
      throw new Error(message);
    }
    return body.clientSecret;
  }, [offer.slug]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  const stripePromise = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey]
  );

  return (
    <div className="min-h-screen bg-[#f4f7fb] lg:grid lg:min-h-screen lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <OrderSummaryPanel offer={offer} />
        </div>
      </div>

      <div className="relative flex flex-col">
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:max-w-none lg:px-10 lg:py-10">
          <div className="mb-5 flex justify-center lg:hidden">
            <Image
              src="/profit-coach-logo.svg"
              alt="Profit Coach"
              width={200}
              height={56}
              className="h-auto w-[132px]"
              priority
            />
          </div>

          <MobileOrderSummary offer={offer} />

          <div className="mt-5 min-w-0 lg:mt-0">
            {!publishableKey ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Add{" "}
                <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                </code>{" "}
                to continue.
              </div>
            ) : (
              <>
                {error ? (
                  <p
                    className="mb-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                <div id="checkout" className="min-h-[520px]">
                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={options}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
                <div className="mt-4 flex justify-center lg:justify-start">
                  <TrustMarks tone="light" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
