"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

import type { ProgrammeJoinOffer } from "@/config/programmeJoinOffers";
import { BCA_BUSINESS_CONTACT } from "@/config/businessContact";
import { JoinPriceCheckDot } from "@/components/join/JoinPriceCheckDot";

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
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${label}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${iconWrap}`}
        >
          <ShieldIcon className="h-4 w-4" />
        </span>
        Secure checkout
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${iconWrap}`}
        >
          <LockIcon className="h-4 w-4" />
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
      <div className="flex flex-1 flex-col px-[76px] py-10 lg:px-[96px] lg:py-12">
        <Image
          src="/brand/profit-coach-logo-white.svg"
          alt="Profit Coach"
          width={200}
          height={56}
          className="-ml-[15px] mb-8 h-auto w-[148px]"
          priority
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          Order summary
        </p>
        <h2 className="mt-2 text-balance text-[1.625rem] font-semibold tracking-tight">
          {offer.headline}
        </h2>
        <p className="mt-1 text-[15px] text-white/70">{offer.title}</p>

        <div className="mt-7 space-y-4 border-t border-white/15 pt-5 text-base">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-white">Today&apos;s payment</p>
              <p className="mt-0.5 text-[15px] text-white/65">{offer.headline}</p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {offer.todayAmountLabel}
            </p>
          </div>

          {hasFuture ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-white">Future payments</p>
                <p className="mt-0.5 text-[15px] text-white/65">
                  {offer.futurePaymentsDetail}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {offer.futureAmountLabel}
              </p>
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4 border-t border-white/15 pt-4">
            <p className="font-medium text-white">Total</p>
            <p className="shrink-0 text-lg font-semibold tabular-nums">
              {offer.totalAmountLabel}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-12 text-[13px] leading-relaxed text-white/70">
          <p>Need help with this order?</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <a
              href={BCA_BUSINESS_CONTACT.phoneTelHref}
              className="inline-flex items-center gap-2 text-[15px] font-medium text-white/90 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                aria-hidden
              >
                <path
                  d="M7 3.75h3.2l1.1 3.3-1.85 1.1a12.6 12.6 0 006.4 6.4l1.1-1.85 3.3 1.1V17a1.75 1.75 0 01-1.75 1.75A14.25 14.25 0 015.25 4.5 1.75 1.75 0 017 3.75z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              {BCA_BUSINESS_CONTACT.phoneDisplay}
            </a>
            <span className="text-[12px] font-medium uppercase tracking-wide text-white/50">
              or
            </span>
            <a
              href={BCA_BUSINESS_CONTACT.whatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1a9e4f] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#1db058]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M12.04 2C6.5 2 2 6.37 2 11.76c0 1.72.46 3.4 1.34 4.88L2 22l5.53-1.45a10.2 10.2 0 004.51 1.05h.01c5.54 0 10.04-4.37 10.04-9.76C22.09 6.37 17.58 2 12.04 2zm5.84 13.77c-.24.68-1.4 1.25-1.93 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.95-.31-1.64-.6-2.89-1.25-4.77-4.16-4.92-4.35-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.63.48.24.56.8 1.95.87 2.1.07.14.12.3.02.49-.1.2-.14.32-.28.49-.14.17-.3.38-.42.51-.14.14-.28.29-.12.56.16.28.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07.17-.2.7-.81.88-1.09.19-.28.37-.23.63-.14.25.1 1.6.76 1.87.89.28.14.46.2.53.31.07.11.07.64-.17 1.32z" />
              </svg>
              WhatsApp us
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileOrderSummary({ offer }: { offer: ProgrammeJoinOffer }) {
  return (
    <div className={`rounded-2xl px-6 py-4 ${summaryPanelClassName} lg:hidden`}>
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
        <div className="mt-3 flex items-start justify-between gap-4 text-[13px]">
          <p className="text-white/70">{offer.futurePaymentsDetail}</p>
          <p className="shrink-0 font-semibold tabular-nums">
            {offer.futureAmountLabel}
          </p>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3">
        <p className="text-sm font-medium">Total</p>
        <p className="text-sm font-semibold tabular-nums">
          {offer.totalAmountLabel}
        </p>
      </div>
    </div>
  );
}

/**
 * Hybrid checkout: branded order summary (left) + Stripe Embedded Checkout (right).
 * Stripe owns wallets / Link / card UI; we own plan schedule clarity.
 */
export function JoinHybridCheckoutPage({ offer, publishableKey }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionPriceId, setSessionPriceId] = useState<string | null>(null);
  const [priceNickname, setPriceNickname] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stripePromise = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey]
  );

  useEffect(() => {
    if (!publishableKey) return;

    let cancelled = false;
    setClientSecret(null);
    setSessionPriceId(null);
    setPriceNickname(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/join/checkout/embedded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offer: offer.slug }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          clientSecret?: string;
          priceId?: string;
          priceNickname?: string | null;
          error?: string;
        };
        if (!res.ok || !body.clientSecret) {
          throw new Error(body.error ?? "Could not start secure checkout.");
        }
        if (!cancelled) {
          setClientSecret(body.clientSecret);
          setSessionPriceId(body.priceId ?? offer.priceId);
          setPriceNickname(body.priceNickname ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not start secure checkout."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offer.slug, publishableKey]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] lg:grid lg:min-h-screen lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <OrderSummaryPanel offer={offer} />
        </div>
      </div>

      <div className="relative flex flex-col">
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:max-w-none lg:px-10 lg:pb-10 lg:pt-14">
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
            ) : error ? (
              <p
                className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200"
                role="alert"
              >
                {error}
              </p>
            ) : clientSecret && stripePromise ? (
              <>
                <div id="checkout" className="min-h-[620px] w-full [&_iframe]:min-h-[620px] [&_iframe]:w-full">
                  <EmbeddedCheckoutProvider
                    key={clientSecret}
                    stripe={stripePromise}
                    options={{ clientSecret }}
                  >
                    <EmbeddedCheckout className="w-full" />
                  </EmbeddedCheckoutProvider>
                </div>
                <div className="mt-4 flex justify-center lg:justify-start">
                  <TrustMarks tone="light" />
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">
                Loading secure checkout…
              </div>
            )}
          </div>
        </div>
      </div>
      <JoinPriceCheckDot
        nickname={priceNickname}
        priceId={sessionPriceId ?? offer.priceId}
      />
    </div>
  );
}
