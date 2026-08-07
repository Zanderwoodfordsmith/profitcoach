import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Profit Coach for LinkedIn",
  description:
    "How the Profit Coach for LinkedIn Chrome extension handles profile data, cookies, and account access.",
  robots: { index: true, follow: true },
};

export default function LinkedInExtensionPrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <article className="mx-auto max-w-2xl space-y-6 text-[15px] leading-relaxed">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Profit Coach / Business Coach Academy
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Profit Coach for LinkedIn — privacy policy
        </h1>
        <p className="text-slate-600">Last updated: 7 August 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What this extension does</h2>
          <p>
            The <strong>Profit Coach for LinkedIn</strong> Chrome extension helps
            coaches save LinkedIn profiles they are viewing into their Profit
            Coach pipeline, draft personalized connection notes and DMs that they
            send themselves, and optionally save a Sales Navigator browser
            session for lead imports inside Profit Coach.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Data we access</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            <li>
              <strong>Visible LinkedIn profile fields</strong> on pages you open
              (name, headline, company, about, profile URL, photo URL when
              present), only when you use Save or Draft in the side panel.
            </li>
            <li>
              <strong>LinkedIn cookies</strong> for <code>linkedin.com</code>{" "}
              (including session cookies such as <code>li_at</code>), only when
              you click <em>Save Sales Nav session</em> or <em>Copy cookies</em>.
            </li>
            <li>
              <strong>Your browser user agent</strong>, saved with a Sales Nav
              session so imports match the browser that created the cookies.
            </li>
            <li>
              <strong>Profit Coach login</strong> — if a Profit Coach tab is open
              and you are signed in, the extension reads your session token from
              that tab so actions attach to <em>your</em> account.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">How we use the data</h2>
          <p>
            Profile fields are sent to Profit Coach APIs you trigger, to create
            or update prospects and to generate draft outreach copy. Sales
            Navigator session data is stored on Profit Coach servers and used
            only for searches / imports you (or workspace admins) initiate in
            the app. We do not sell this data. We do not use it for advertising.
            The extension does not auto-send LinkedIn messages, connection
            requests, comments, or likes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Membership</h2>
          <p>
            Save and Draft require a Profit Coach membership that includes
            marketing tools. If your access tier no longer includes those tools,
            the extension cannot save prospects or draft messages for your
            account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Clipboard</h2>
          <p>
            If you choose <em>Copy</em> on a draft, or <em>Copy cookies</em>,
            content may be written to your clipboard. Clipboard contents stay on
            your device unless you paste them elsewhere.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Storage &amp; retention</h2>
          <p>
            Prospects and account-saved sessions are stored in your Profit Coach
            account (HTTPS in transit). You can update a prospect by saving
            again, or replace a Sales Nav session by saving again from the
            extension. Contact us to request deletion. The extension may store
            your preferred Profit Coach site and recent profile context locally
            in the browser.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p>
            Business Coach Academy —{" "}
            <a
              className="text-sky-700 underline"
              href="https://www.businesscoachacademy.com"
            >
              businesscoachacademy.com
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
