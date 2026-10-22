"use client";

import { useState } from "react";
import { Check, Copy, Tag } from "lucide-react";
import { cleanTag, taggedLink, TRAFFIC_CHANNELS } from "@/lib/trafficSource";

/**
 * Toolkit → Links: put a tag on a link so a BOSS Score or opt-in shows where
 * it came from ("BOSS Score · via LinkedIn" on the prospect).
 */
export function TaggedLinkMaker({ links }: { links: { label: string; url: string }[] }) {
  const [linkIndex, setLinkIndex] = useState(0);
  const [channel, setChannel] = useState("linkedin");
  const [other, setOther] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);
  if (!links.length) return null;

  const source = channel === "other" ? cleanTag(other) : channel;
  const base = links[Math.min(linkIndex, links.length - 1)]!.url;
  const url = source ? taggedLink(base, source, campaign) : base;
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-[#0c5290] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0c5290]">
          <Tag className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Tag a link, see where people come from</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Use a tagged link on LinkedIn, YouTube or anywhere else. Each BOSS Score and opt-in then shows where it came from.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="block max-w-sm text-xs font-medium text-slate-600">
          Link
          <select
            id="tag-link"
            value={linkIndex}
            onChange={(e) => {
              setLinkIndex(Number(e.target.value));
              setCopied(false);
            }}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            {links.map((l, i) => (
              <option key={l.url} value={i}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-xs font-medium text-slate-600">Where you&apos;ll use it</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Where you'll use it">
            {[...TRAFFIC_CHANNELS, { value: "other", label: "Somewhere else", medium: "" }].map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={channel === c.value}
                onClick={() => {
                  setChannel(c.value);
                  setCopied(false);
                }}
                className={chip(channel === c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          {channel === "other" ? (
            <input
              id="tag-other"
              value={other}
              onChange={(e) => {
                setOther(e.target.value);
                setCopied(false);
              }}
              placeholder="e.g. podcast, networking event"
              className="mt-2 h-10 w-full max-w-sm rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
            />
          ) : null}
        </div>

        <label className="block max-w-sm text-xs font-medium text-slate-600">
          Name it (optional)
          <input
            id="tag-campaign"
            value={campaign}
            onChange={(e) => {
              setCampaign(e.target.value);
              setCopied(false);
            }}
            placeholder="e.g. october newsletter"
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
          />
        </label>

        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all text-xs text-slate-700">{url}</code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0c5290] px-4 text-sm font-semibold text-white hover:bg-[#08396a]"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </section>
  );
}
