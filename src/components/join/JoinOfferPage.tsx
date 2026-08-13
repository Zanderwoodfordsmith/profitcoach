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

function getStripe(publishableKey: string) {
  // One Stripe.js instance per publishable key (module-level cache).
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

export function JoinOfferPage({ offer, publishableKey }: Props) {
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

  const options = useMemo(
    () => ({ fetchClientSecret }),
    [fetchClientSecret]
  );

  const stripePromise = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey]
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(120%_80%_at_50%_-10%,#dbebff_0%,#f8fafc_42%,#f1f5f9_100%)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex justify-center sm:mb-10 sm:justify-start">
          <Image
            src="/profit-coach-logo.svg"
            alt="Profit Coach"
            width={220}
            height={62}
            className="h-auto w-[160px] sm:w-[200px]"
            priority
          />
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0c5290]">
              {offer.title}
            </p>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-slate-900">
              {offer.headline}
            </h1>

            <div className="mt-6 rounded-xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200/80">
              <p className="text-3xl font-semibold tracking-tight text-slate-900">
                {offer.amountLabel}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {offer.totalLabel}
              </p>
            </div>

            <ul className="mt-6 space-y-2.5">
              {offer.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm leading-relaxed text-slate-600">
              Pay securely on this page. After payment you’ll continue straight
              into welcome setup and orientation booking.
            </p>
          </section>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            {!publishableKey ? (
              <div className="rounded-xl bg-amber-50 px-4 py-6 text-sm text-amber-950 ring-1 ring-amber-200">
                <p className="font-semibold">Stripe publishable key missing</p>
                <p className="mt-1 text-amber-900/90">
                  Add{" "}
                  <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                  </code>{" "}
                  (or{" "}
                  <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                    STRIPE_PUBLISHABLE_KEY
                  </code>
                  ) to the environment, then restart the app.
                </p>
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
                <div id="checkout" className="min-h-[480px]">
                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={options}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
