"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Sparkles, X } from "lucide-react";

import { figtree } from "@/fonts";
import { PUSHBACK_HELP } from "@/lib/simulator/difficulty";
import { faceOf } from "@/lib/simulator/faces";
import type { SimClient } from "@/lib/simulator/types";

import { AiWorking } from "./AiWorking";
import { useSimApi } from "./simApi";
import "./sim.css";

type Step = "describe" | "building" | "check" | "changing" | "face";

const EXAMPLE =
  "A family-run bakery chain with four shops in Bristol, about £2M turnover. The owner, in her fifties, wants to open a fifth shop, but two of the four barely make money and her son, who runs production, wants to sell wholesale to cafés instead. They argue about it in every meeting. She's tried a consultant before and felt talked down to.";

/**
 * "Create your own": describe a situation, the AI builds the client, the
 * coach checks it ("Does this sound right?"), changes anything, then
 * confirms. Opens straight on the check step for a draft.
 */
export function CreateClient({ draft, onClose }: { draft?: SimClient | null; onClose: (client: SimClient | null) => void }) {
  const api = useSimApi();
  const [step, setStep] = useState<Step>(draft ? "check" : "describe");
  const [situation, setSituation] = useState("");
  const [isReal, setIsReal] = useState(true);
  const [client, setClient] = useState<SimClient | null>(draft ?? null);
  const [change, setChange] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function build() {
    setError(null);
    setStep("building");
    const res = await api<{ client: SimClient }>("/api/coach/simulator/custom", { method: "POST", body: { situation, isReal } });
    if (!res.ok) {
      setError(res.error);
      setStep("describe");
      return;
    }
    setClient(res.data.client);
    setStep("check");
  }

  async function revise() {
    if (!client?.custom || !change.trim()) return;
    setError(null);
    setStep("changing");
    const res = await api<{ client: SimClient }>(`/api/coach/simulator/custom/${client.custom.rowId}`, { method: "PATCH", body: { change } });
    if (!res.ok) {
      setError(res.error);
      setStep("check");
      return;
    }
    setClient(res.data.client);
    setChange("");
    setStep("check");
  }

  async function confirm() {
    if (!client?.custom) return;
    setError(null);
    const res = await api<{ client: SimClient }>(`/api/coach/simulator/custom/${client.custom.rowId}`, { method: "PATCH", body: { confirm: true } });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    let ready = res.data.client;
    if (!ready.face) {
      setStep("face");
      const face = await api<{ face: string }>(`/api/coach/simulator/custom/${client.custom.rowId}/face`, { method: "POST" });
      if (face.ok) ready = { ...ready, face: face.data.face };
    }
    onClose(ready);
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`sim ${figtree.className} fixed inset-0 z-[100]`} role="dialog" aria-modal="true" aria-label="Create your own client">
      <div className="sim-room sim-scroll flex h-full flex-col overflow-y-auto">
        <header className="relative z-[3] flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-8">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--sim-cream-soft)]">
            <Sparkles className="h-4 w-4" aria-hidden /> Create your own client
          </p>
          <button type="button" onClick={() => onClose(null)} className="rounded-full p-2 text-[var(--sim-cream-soft)] hover:bg-[var(--sim-glass)] hover:text-[var(--sim-cream)]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="relative z-[2] mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10 sm:px-10">
          {step === "describe" ? (
            <>
              <h1 className="text-[clamp(2rem,4.5vw,3.4rem)] font-light leading-[1.05] tracking-[-0.03em]">Describe a situation you want to practise.</h1>
              <p className="mt-4 max-w-xl text-read leading-relaxed text-[var(--sim-cream-soft)]">
                The business, the owner, the problem, and anything specific: numbers, people, what they&rsquo;ve tried. The more you give, the more real they&rsquo;ll feel.
              </p>
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                rows={7}
                placeholder={EXAMPLE}
                className="sim-scroll mt-8 w-full resize-y rounded-2xl border border-[var(--sim-cream-line)] bg-[rgba(5,30,54,0.5)] px-5 py-4 text-read leading-relaxed text-[var(--sim-cream)] outline-none placeholder:text-[var(--sim-cream-faint)] focus:border-[var(--sim-cream)]"
                autoFocus
              />
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[var(--sim-cream-soft)]">
                Is this real?
                <div className="sim-seg" role="group" aria-label="Is this a real situation?">
                  <button type="button" aria-pressed={isReal} onClick={() => setIsReal(true)}>
                    Yes, it&rsquo;s real
                  </button>
                  <button type="button" aria-pressed={!isReal} onClick={() => setIsReal(false)}>
                    No, made up
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--sim-cream-faint)]">
                We always change names and details, so nobody real can be recognised, even if you share it.
              </p>
              {error ? <p className="mt-4 text-sm text-[var(--sim-amber)]">{error}</p> : null}
              <div className="mt-8">
                <button type="button" className="sim-pill sim-pill-solid !px-6 !py-3.5 text-base" disabled={situation.trim().length < 40} onClick={() => void build()}>
                  <Sparkles className="h-4 w-4" aria-hidden /> Build my client
                </button>
              </div>
            </>
          ) : step === "building" || step === "changing" || step === "face" ? (
            <div className="grid place-items-center">
              <AiWorking
                title={step === "building" ? "Building your client" : step === "changing" ? "Making your changes" : "Giving them a face"}
                steps={
                  step === "building"
                    ? ["Reading your situation", "Writing their story", "Hiding the facts to find", "Choosing how they push back", "Giving them a voice"]
                    : step === "changing"
                      ? ["Reading what you want changed", "Rewriting the client", "Checking it still hangs together"]
                      : ["Picturing them", "Painting the portrait"]
                }
                seconds={step === "building" ? 30 : step === "changing" ? 25 : 15}
              />
            </div>
          ) : client ? (
            <>
              <p className="text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">Does this sound right?</p>
              <div className="mt-6 grid items-center gap-8 sm:grid-cols-[auto_1fr]">
                <div className="sim-face mx-auto aspect-square w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faceOf(client)} alt="" />
                </div>
                <div>
                  <p className="text-[clamp(2rem,4vw,3rem)] font-light leading-none tracking-[-0.03em]">{client.name}</p>
                  <p className="mt-2 text-sm text-[var(--sim-cream-soft)]">
                    {client.age} · {client.role}, {client.business}, {client.place} · {client.personality}
                  </p>
                  <p className="mt-4 text-[clamp(1.2rem,2vw,1.5rem)] font-light leading-snug">{client.line}</p>
                </div>
              </div>
              <p className="mt-6 text-read leading-relaxed text-[var(--sim-cream-soft)]">{client.brief}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">What you&rsquo;ll need to find out</p>
                  <ul className="mt-3 grid gap-2">
                    {client.facts.map((f) => (
                      <li key={f.id} className="sim-fact">
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">How they push back</p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--sim-cream)]">{PUSHBACK_HELP[client.pushback.kind]?.title.replace(/^When they/, "They")}.</p>
                  <ul className="mt-2 space-y-1.5">
                    {client.pushback.medium.slice(0, 3).map((p) => (
                      <li key={p} className="text-sm leading-snug text-[var(--sim-cream-soft)]">
                        &ldquo;{p}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-8 rounded-2xl border border-[var(--sim-cream-line)] p-4">
                <label className="block text-sm text-[var(--sim-cream-soft)]">
                  Want anything changed?
                  <textarea
                    value={change}
                    onChange={(e) => setChange(e.target.value)}
                    rows={2}
                    placeholder="e.g. Make him more stubborn about price, and the business should be in Leeds."
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--sim-cream-line)] bg-[rgba(5,30,54,0.5)] px-3.5 py-2.5 text-ui text-[var(--sim-cream)] outline-none placeholder:text-[var(--sim-cream-faint)] focus:border-[var(--sim-cream)]"
                  />
                </label>
                <button type="button" className="sim-pill sim-pill-line mt-3" disabled={!change.trim()} onClick={() => void revise()}>
                  Change it
                </button>
              </div>
              {error ? <p className="mt-4 text-sm text-[var(--sim-amber)]">{error}</p> : null}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" className="sim-pill sim-pill-solid !px-6 !py-3.5 text-base" onClick={() => void confirm()}>
                  <Check className="h-4 w-4" aria-hidden /> Yes, that&rsquo;s them
                </button>
                {!draft ? (
                  <button
                    type="button"
                    className="sim-pill sim-pill-line"
                    onClick={() => {
                      // Rebuilding makes a new draft, so this one goes.
                      if (client.custom) void api(`/api/coach/simulator/custom/${client.custom.rowId}`, { method: "DELETE" });
                      setClient(null);
                      setStep("describe");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the description
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>,
    document.body
  );
}
