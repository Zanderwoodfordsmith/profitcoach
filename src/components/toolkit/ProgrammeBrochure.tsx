"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProgrammeBrochure } from "@/lib/practiceKnowledge/brochure";
import { GOOGLE_FONTS_HREF } from "@/lib/printPack/brand.js";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import "./brochure.css";

function blueprintHref(pathname: string, href: string) {
  if (pathname.startsWith("/admin")) {
    return href.replace("/coach/blueprint", "/admin/blueprint/coach");
  }
  return href;
}

function printBrochure(title: string, html: string) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "")}</title>
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}">
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
${printCss()}
</style></head><body>${html}</body></html>`;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  iframe.srcdoc = doc;
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    void win.document.fonts?.ready.then(() => {
      win.addEventListener("afterprint", cleanup, { once: true });
      win.focus();
      win.print();
    });
  };
}

function printCss(): string {
  return `
.pb-sheet{box-sizing:border-box;width:210mm;min-height:297mm;padding:18mm 16mm 16mm;color:#0d1f31;background:#fff;font-family:Inter,"Helvetica Neue",Arial,sans-serif;overflow:hidden;break-after:page}
.pb-sheet:last-child{break-after:auto}
.pb-sheet--cover{display:flex;flex-direction:column;color:#f4f8fc;background:radial-gradient(120% 70% at 100% 0%,#1a8fd4 0%,transparent 55%),linear-gradient(165deg,#051e36 0%,#0c5290 72%,#0a467b 100%)}
.pb-cover-name{margin:0;font-family:"Inter Tight",Inter,sans-serif;font-size:42pt;font-weight:700;letter-spacing:-.035em;line-height:.95}
.pb-cover-role{margin:10px 0 0;font-size:13pt;font-weight:500;color:#c5d8ea}
.pb-cover-title{margin:auto 0 8mm;max-width:28ch;font-family:"Inter Tight",Inter,sans-serif;font-size:28pt;font-weight:600;letter-spacing:-.03em;line-height:1.12}
.pb-cover-line{margin:0;max-width:36ch;font-size:13.5pt;line-height:1.4;color:#e4eef7}
.pb-cover-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-top:14mm}
.pb-stats{display:flex;gap:16px}
.pb-stat b{display:block;font-family:"Inter Tight",Inter,sans-serif;font-size:18pt;font-weight:700;letter-spacing:-.03em}
.pb-stat span{display:block;margin-top:2px;font-size:8.5pt;color:#c5d8ea}
.pb-photo{width:38mm;height:38mm;flex:none;object-fit:cover;border-radius:50%;border:3px solid rgba(255,255,255,.45)}
.pb-photo--empty{display:grid;place-items:center;background:rgba(255,255,255,.12);color:#c5d8ea;font-family:"Inter Tight",Inter,sans-serif;font-size:22pt;font-weight:700}
.pb-h{margin:0 0 6mm;font-family:"Inter Tight",Inter,sans-serif;font-size:22pt;font-weight:700;letter-spacing:-.03em;line-height:1.1}
.pb-lede{margin:-2mm 0 10mm;max-width:48ch;font-size:12pt;line-height:1.45;color:#46566b}
.pb-block{margin:0 0 9mm}
.pb-block h3{margin:0 0 3.5mm;font-family:"Inter Tight",Inter,sans-serif;font-size:13pt;font-weight:600;letter-spacing:-.02em}
.pb-block p,.pb-block li{margin:0;font-size:11pt;line-height:1.45}
.pb-list{margin:0;padding:0;list-style:none}
.pb-list li+li{margin-top:2.5mm}
.pb-quote{padding:0;border:0}
.pb-quote p{font-size:13pt;line-height:1.4}
.pb-quote cite{display:block;margin-top:3mm;font-style:normal;font-size:10pt;color:#46566b}
.pb-steps{margin:0;padding:0;list-style:none;counter-reset:pb}
.pb-steps li{display:grid;grid-template-columns:9mm 1fr;gap:4mm;align-items:start;counter-increment:pb}
.pb-steps li+li{margin-top:4mm}
.pb-steps li::before{content:counter(pb);font-family:"Inter Tight",Inter,sans-serif;font-size:13pt;font-weight:700;color:#0c5290}
.pb-cta{margin-top:auto;padding:8mm 8mm 7mm;color:#f4f8fc;background:#051e36}
.pb-cta h2{margin:0 0 2mm;font-family:"Inter Tight",Inter,sans-serif;font-size:18pt;font-weight:700;letter-spacing:-.03em}
.pb-cta p{margin:0 0 5mm;max-width:42ch;font-size:11pt;line-height:1.4;color:#c5d8ea}
.pb-cta a{color:#fff;font-weight:650;text-decoration:none}
.pb-meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:8mm;font-size:10pt;color:#46566b}
.pb-sheet--about{display:flex;flex-direction:column}
`;
}

function Sheets({ pack, showFee }: { pack: ProgrammeBrochure; showFee: boolean }) {
  const initial = pack.coachName.trim().slice(0, 1).toUpperCase() || "Y";
  return (
    <>
      <article className="pb-sheet pb-sheet--cover">
        <p className="pb-cover-name">{pack.coachName}</p>
        <p className="pb-cover-role">{pack.role}</p>
        <h1 className="pb-cover-title">A 90-day programme for owners who want their week back.</h1>
        {pack.headline ? <p className="pb-cover-line">{pack.headline}</p> : null}
        <div className="pb-cover-foot">
          <div className="pb-stats">
            {pack.stats.map((stat) => (
              <div className="pb-stat" key={`${stat.value}-${stat.label}`}>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          {pack.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- print pack photos come from storage.
            <img className="pb-photo" src={pack.photoUrl} alt="" />
          ) : (
            <div className="pb-photo pb-photo--empty" aria-hidden>
              {initial}
            </div>
          )}
        </div>
      </article>

      <article className="pb-sheet">
        <h2 className="pb-h">What the ninety days are for</h2>
        {pack.whoFor ? <p className="pb-lede">{pack.whoFor}</p> : null}

        {pack.problems.length ? (
          <div className="pb-block">
            <h3>If this sounds familiar</h3>
            <ul className="pb-list">
              {pack.problems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {pack.helpWith.length ? (
          <div className="pb-block">
            <h3>What we actually work on</h3>
            <ol className="pb-steps">
              {pack.helpWith.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}

        {pack.format || pack.timeframe ? (
          <div className="pb-block">
            <h3>How we work</h3>
            <p>
              {[pack.format, pack.timeframe]
                .filter((part): part is string => Boolean(part))
                .map((part) => part.replace(/\.+$/, ""))
                .join(". ")}
              .
            </p>
          </div>
        ) : null}

        {showFee && pack.fee ? (
          <div className="pb-block">
            <h3>Investment</h3>
            <p>{pack.fee}</p>
          </div>
        ) : null}
      </article>

      <article className="pb-sheet pb-sheet--about">
        <h2 className="pb-h">Why {pack.firstName}</h2>
        {pack.bio || pack.intro ? <p className="pb-lede">{pack.bio || pack.intro}</p> : null}

        {pack.testimonials[0] ? (
          <blockquote className="pb-quote pb-block">
            <p>{pack.testimonials[0].quote}</p>
            <cite>{pack.testimonials[0].cite}</cite>
          </blockquote>
        ) : null}

        <div className="pb-cta">
          <h2>Start with your BOSS Score</h2>
          <p>Fifteen minutes. You will see where the business actually stands, then we talk about the quarter if it is a fit.</p>
          {pack.scoreUrl ? <a href={pack.scoreUrl}>theprofitcoach.com{pack.scoreUrl}</a> : <p>Set your public link to print your score page here.</p>}
        </div>
        <div className="pb-meta">
          {pack.location ? <span>{pack.location}</span> : null}
          {pack.website ? <span>{pack.website.replace(/^https?:\/\//, "")}</span> : null}
        </div>
      </article>
    </>
  );
}

export function ProgrammeBrochureCard({
  pack,
  pathname,
}: {
  pack: ProgrammeBrochure | null;
  pathname: string;
}) {
  const [showFee, setShowFee] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePrint() {
    if (!pack?.ready) return;
    setError(null);
    setBusy(true);
    try {
      const root = document.getElementById("programme-brochure-print");
      if (!root) throw new Error("missing");
      printBrochure(`${pack.coachName} 90-day programme`, root.innerHTML);
    } catch {
      setError("Could not open the print view. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="max-w-3xl space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Documents you send</h2>
        <p className="text-base leading-relaxed text-slate-600">
          Filled from your Blueprint. Send the 90-day programme to someone who asked how you work. Price stays off unless you turn it on.
        </p>
      </div>

      <article className={cardClass("plain", "overflow-hidden")}>
        {!pack || !pack.ready ? (
          <div className="space-y-4 p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-slate-900">90-day programme</h3>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Write Your Story and Your Offer in the Blueprint first. This pack pulls the bio, the problems owners already ask, and what you help with.
            </p>
            {pack?.gaps.length ? (
              <ul className="flex flex-wrap gap-2">
                {pack.gaps.map((gap) => (
                  <li key={gap.href + gap.label}>
                    <Link href={blueprintHref(pathname, gap.href)} className={buttonClass("second", "small")}>
                      {gap.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto bg-slate-100 px-4 py-6 sm:px-6">
              <div id="programme-brochure-print" className="pb-preview" aria-label="90-day programme brochure preview">
                <Sheets pack={pack} showFee={showFee} />
              </div>
            </div>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">90-day programme</h3>
                <p className="text-sm text-slate-500">3 pages, A4. Print or save as PDF.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showFee}
                    onChange={(event) => setShowFee(event.target.checked)}
                    className="size-4 rounded border-slate-300 text-[#0c5290] focus:ring-sky-500"
                  />
                  Show the fee
                </label>
                <button type="button" className={buttonClass("main")} disabled={busy} onClick={handlePrint}>
                  {busy ? "Opening…" : "Print or save PDF"}
                </button>
              </div>
            </div>
            {error ? <p className="px-4 pb-4 text-sm text-red-700">{error}</p> : null}
          </>
        )}
      </article>
    </section>
  );
}
