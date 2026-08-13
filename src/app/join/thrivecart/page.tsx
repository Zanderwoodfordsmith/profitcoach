"use client";

import Script from "next/script";

/**
 * ThriveCart product 62 embed preview (account: stryv).
 */
export default function ThriveCartEmbedPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div
          data-thrivecart-account="stryv"
          data-thrivecart-tpl="v2"
          data-thrivecart-product="62"
          className="thrivecart-embeddable"
          data-thrivecart-embeddable="tc-stryv-62-DH39RH"
        />
        <Script
          id="tc-stryv-62-DH39RH"
          src="https://tinder.thrivecart.com/embed/v1/thrivecart.js"
          strategy="afterInteractive"
        />
      </div>
    </main>
  );
}
