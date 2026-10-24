"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { figtree } from "@/fonts";
import { SiteFooter, SiteNav } from "@/components/marketing/SiteNav";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  bestGuessDestination,
  destinationsForRole,
  type NotFoundRole,
} from "@/lib/notFoundDestinations";
import { destinationIcon } from "./destinationIcons";
import { EmptyBossWheel } from "./EmptyBossWheel";

type Viewer =
  | { state: "checking" }
  | { state: "guest" }
  | { state: "member"; role: NotFoundRole; firstName: string | null };

function firstNameFrom(profile: { first_name: string | null; full_name: string | null } | null) {
  const first = profile?.first_name?.trim() || profile?.full_name?.trim().split(/\s+/)[0];
  return first || null;
}

function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setViewer({ state: "guest" });
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("role, first_name, full_name")
        .eq("id", session.user.id)
        .maybeSingle();
      const role: NotFoundRole =
        data?.role === "admin" || data?.role === "client" ? data.role : "coach";
      if (!cancelled) setViewer({ state: "member", role, firstName: firstNameFrom(data) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return viewer;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C5290]";

function GuestNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex flex-1 flex-col items-center px-5 pb-24 pt-[clamp(2.5rem,7vh,5rem)] text-center sm:px-8">
        <EmptyBossWheel countdown className="w-[min(17rem,68vw)]" />
        <h1 className="mt-[clamp(2.25rem,5vh,3.25rem)] max-w-[22ch] text-[clamp(2.25rem,1.3rem+3.2vw,3.9rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-balance">
          <span className="block font-light text-[#46566B]">This page scores 0 out of 100.</span>
          <span className="block">Let’s find out what your business scores.</span>
        </h1>
        <p className="mt-5 max-w-[36rem] text-[clamp(1.1rem,1.02rem+0.35vw,1.3rem)] leading-normal text-[#46566B] text-pretty">
          The page you wanted isn’t here. The link may be old or have a typo. While you’re here,
          see where your own business stands.
        </p>
        <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/score"
            className={`group inline-flex h-[3.4rem] items-center gap-2 rounded-full bg-[#0C5290] px-7 text-[1.0625rem] font-semibold text-white shadow-[0_12px_28px_-12px_rgb(12_82_144/0.65)] transition-colors hover:bg-[#0A467B] ${focusRing}`}
          >
            Get my free BOSS Score
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            href="/"
            className={`rounded-full px-3 py-2 text-[1.0625rem] font-semibold text-[#0C5290] underline-offset-4 hover:underline ${focusRing}`}
          >
            Back to the home page
          </Link>
        </div>
        <p className="mt-5 text-[0.95rem] text-[#5A6B7F]">
          Free. Your score out of 100, your level, and what to work on first.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function MemberNotFound({ role, firstName }: { role: NotFoundRole; firstName: string | null }) {
  const pathname = usePathname() ?? "";
  const destinations = destinationsForRole(role);
  const guess = bestGuessDestination(pathname, destinations);
  const rows = [
    ...(guess ? [guess] : []),
    ...destinations.filter((d) => d.listed && d !== guess),
  ];
  const home = destinations[0]!;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-[4.5rem] w-full max-w-[82rem] items-center px-5 sm:px-[clamp(1.25rem,5vw,5.5rem)]">
        <Link href={home.href} aria-label={`The Profit Coach, back to ${home.label}`} className={`flex rounded ${focusRing}`}>
          <img src="/brand/profit-coach-logo-site.svg" alt="" width={178} height={27} className="h-[1.7rem] w-auto" />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center px-5 pb-20 pt-[clamp(1.5rem,5vh,3.5rem)] sm:px-8">
        <div className="w-full max-w-[34rem]">
          <div className="flex flex-col items-center text-center">
            <EmptyBossWheel className="w-[min(12rem,48vw)]" />
            <h1 className="mt-8 text-[clamp(2rem,1.4rem+2.2vw,3rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-balance">
              <span className="block font-light text-[#46566B]">
                {firstName ? `Hey ${firstName},` : "Hey there,"}
              </span>
              <span className="block">where are you trying to get to?</span>
            </h1>
            <p className="mt-4 max-w-[30rem] text-[1.125rem] leading-normal text-[#46566B] text-pretty">
              That page isn’t here. The link may be old, or the page has moved.
              {guess ? " Our best guess is first." : " Pick where you were heading."}
            </p>
          </div>

          <nav aria-label="Where to go" className="mt-9">
            <ul className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_1px_2px_rgb(19_45_73/0.06),0_14px_36px_-16px_rgb(19_45_73/0.22)] ring-1 ring-[#E3E8EF]">
              {rows.map((d) => {
                const Icon = destinationIcon(d.href);
                const isGuess = d === guess;
                return (
                  <li key={d.href} className="border-b border-[#EDF1F5] last:border-b-0">
                    <Link
                      href={d.href}
                      className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F3F7FB] focus-visible:bg-[#F3F7FB] focus-visible:outline-none ${
                        isGuess ? "bg-[#EEF5FC]" : ""
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                          isGuess ? "bg-[#0C5290] text-white" : "bg-[#0C5290]/[0.07] text-[#0C5290]"
                        }`}
                      >
                        <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.8} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="text-[1.0625rem] font-semibold text-[#0D1F31]">{d.label}</span>
                          {isGuess ? (
                            <span className="rounded-full bg-[#0C5290] px-2.5 py-0.5 text-[0.75rem] font-semibold text-white">
                              Best guess
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[0.95rem] leading-snug text-[#5A6B7F]">{d.description}</span>
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-[#9AA9B9] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#0C5290]"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <p className="mt-7 text-center text-[0.95rem] text-[#5A6B7F]">
            <button
              type="button"
              onClick={() => window.history.back()}
              className={`rounded font-semibold text-[#0C5290] underline-offset-4 hover:underline ${focusRing}`}
            >
              Go back to the last page
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

/** Where the app shows its own 404, with the sidebar and search. Clients have no such page. */
function inAppNotFoundHref(role: NotFoundRole, missingPath: string): string | null {
  if (role === "client") return null;
  const prefix = role === "admin" ? "/admin" : "/coach";
  return `${prefix}/page-not-found?from=${encodeURIComponent(missingPath)}`;
}

export function NotFoundView() {
  const viewer = useViewer();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const inAppHref =
    viewer.state === "member" ? inAppNotFoundHref(viewer.role, pathname) : null;

  // Coaches and admins see a missing page inside the app they know.
  useEffect(() => {
    if (inAppHref) router.replace(inAppHref);
  }, [inAppHref, router]);

  return (
    <div
      className={`${figtree.className} min-h-screen bg-[#F6F8FB] text-[#0D1F31] antialiased selection:bg-[#0C5290]/15 selection:text-[#0D1F31]`}
    >
      {viewer.state === "checking" || inAppHref ? (
        // Hold the page quiet for the moment it takes to read the session, so
        // members never see the public menu flash in.
        <div className="min-h-screen" aria-busy="true" />
      ) : viewer.state === "guest" ? (
        <GuestNotFound />
      ) : (
        <MemberNotFound role={viewer.role} firstName={viewer.firstName} />
      )}
    </div>
  );
}
