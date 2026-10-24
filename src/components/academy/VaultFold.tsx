"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { supabaseClient } from "@/lib/supabaseClient";
import "./vaultFold.css";

const STORAGE_KEY = "pc-vault-open";

const BLURB =
  "Extra courses: books, talks and how-tos. Enjoy them when you have time. Getting and keeping clients comes first.";

/**
 * The Vault at the foot of Classroom. Folded for new coaches so the programme
 * comes first; open for anyone who has started a Vault lesson. Show and Hide
 * are remembered on this device.
 *
 * "fade" is "rail" where, open, the courses sit inside the card as its
 * background and edges fade away; "rail" (third version) has a grey strip with
 * a chevron at the far right, like the System banner; "card" (second version)
 * has a Show button in the copy; "plain" (first version) is a heading row.
 * Older ones show at ?cards=1, ?cards=2 and ?cards=3.
 */
export function VaultFold({
  lessonIds,
  covers,
  variant = "fade",
  children,
}: {
  lessonIds: string[];
  covers: string[];
  variant?: "fade" | "rail" | "card" | "plain";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function decide() {
      if (window.location.hash === "#vault") {
        setOpen(true);
        return;
      }
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          setOpen(stored === "1");
          return;
        }
      } catch {
        // No storage: fall through to progress.
      }

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token || cancelled) return;
      // Progress comes back for every lesson the coach has opened, whatever the course.
      const response = await fetch("/api/coach/academy/lesson-progress/vault", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await response.json().catch(() => ({}))) as {
        progress?: Record<string, string>;
        lastViewed?: Record<string, string>;
      };
      const started = lessonIds.some(
        (id) =>
          Boolean(body.lastViewed?.[id]) ||
          (body.progress?.[id] !== undefined && body.progress[id] !== "not_started")
      );
      if (!cancelled && started) setOpen(true);
    }

    void decide();
    return () => {
      cancelled = true;
    };
  }, [lessonIds]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Remembering is a nicety; the toggle still works.
    }
  };

  const toggleLabel = (
    <>
      {open ? "Hide" : "Show"}
      <ChevronDown
        className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        aria-hidden
      />
    </>
  );

  // Fade, open: the courses render inside the card instead of below it.
  const fadeOpen = variant === "fade" && open;

  return (
    <section
      id="vault"
      className={`scroll-mt-40 ${variant === "plain" ? "mt-14" : "mt-6"} ${open ? "" : "pb-12"}`}
      aria-labelledby="vault-heading"
    >
      {variant === "rail" || variant === "fade" ? (
        <div className={fadeOpen ? "vault-fold-panel" : undefined}>
          <div
            className={`vault-fold-card vault-fold-card--rail ${fadeOpen ? "vault-fold-card--open" : ""}`}
            onClick={toggle}
          >
            {open ? null : (
              <div className="vault-fold-card__covers" aria-hidden>
                {covers.map((src) => (
                  <div key={src} className="vault-fold-card__cover">
                    {/* eslint-disable-next-line @next/next/no-img-element -- decorative crops of the course covers */}
                    <img src={src} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
            <div className="vault-fold-card__copy flex flex-col justify-center p-5 sm:p-6">
              <h2 id="vault-heading" className="text-lg font-semibold leading-snug tracking-tight text-slate-900">
                The Vault
              </h2>
              <p
                className={`mt-1.5 text-pretty text-sm leading-relaxed text-slate-600 ${
                  fadeOpen ? "" : "max-w-md"
                }`}
              >
                {BLURB}
              </p>
            </div>
            {/* Clicks bubble to the card, which does the toggling. */}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="vault-courses"
              className="vault-fold-card__rail"
            >
              <span className="text-sm font-semibold md:sr-only">{open ? "Hide" : "Show"}</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                strokeWidth={2}
                aria-hidden
              />
            </button>
          </div>
          {fadeOpen ? (
            <div id="vault-courses" className="relative mt-2">
              {children}
            </div>
          ) : null}
        </div>
      ) : variant === "card" ? (
        <div className="vault-fold-card">
          <div className="vault-fold-card__covers" aria-hidden>
            {covers.map((src) => (
              <div key={src} className="vault-fold-card__cover">
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative crops of the course covers */}
                <img src={src} alt="" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="vault-fold-card__copy flex flex-col justify-center p-5 sm:p-6">
            <h2 id="vault-heading" className="text-lg font-semibold leading-snug tracking-tight text-slate-900">
              The Vault
            </h2>
            <p className="mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-slate-600">{BLURB}</p>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls="vault-courses"
              className="vault-fold-card__button mt-4 inline-flex self-start items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0c5290] shadow-sm transition hover:bg-sky-50"
            >
              {toggleLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-slate-200/80 pt-6">
          <div className="min-w-0">
            <h2 id="vault-heading" className="text-xl font-semibold tracking-tight text-slate-900">
              The Vault
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{BLURB}</p>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="vault-courses"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0c5290] shadow-sm ring-1 ring-slate-200 transition hover:bg-sky-50"
          >
            {toggleLabel}
          </button>
        </div>
      )}
      {open && !fadeOpen ? (
        <div id="vault-courses" className="mt-6">
          {children}
        </div>
      ) : null}
    </section>
  );
}
