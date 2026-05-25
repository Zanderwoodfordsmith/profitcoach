"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseClient } from "@/lib/supabaseClient";
import { displayNameFromProfile, profileInitialsFromName } from "@/lib/communityProfile";
import { resolveCommunityBio } from "@/lib/profileBioFields";

type HoverProfile = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  bio?: string | null;
  coach_business_name?: string | null;
  slug?: string | null;
  linkedin_url?: string | null;
};

type Props = {
  userId?: string | null;
  profile?: HoverProfile | null;
  statusLabel?: string | null;
  children: React.ReactNode;
};

const CARD_WIDTH_PX = 720; // ~60% wider than previous 28rem (448px)
const BIO_LINE_CLAMP = 6;
/** Matches text-lg + leading-relaxed line height for reliable clamp fallback. */
const BIO_CLAMP_MAX_HEIGHT = "11.25rem";
const CLOSE_DELAY_MS = 250;

let activeProfileCardId: string | null = null;

function canOpenProfileCard(id: string) {
  return !activeProfileCardId || activeProfileCardId === id;
}

function claimProfileCard(id: string) {
  activeProfileCardId = id;
}

function releaseProfileCard(id: string) {
  if (activeProfileCardId === id) activeProfileCardId = null;
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function CommunityProfileHoverCard({
  userId,
  profile,
  statusLabel,
  children,
}: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const bioPreviewRef = useRef<HTMLDivElement>(null);
  const interactingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<HoverProfile | null>(profile ?? null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const [maxCardHeight, setMaxCardHeight] = useState<number | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioClamped, setBioClamped] = useState(false);

  useEffect(() => {
    setLoaded(profile ?? null);
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    const id = userId ?? loaded?.id ?? null;
    if (!id) return;
    if (
      loaded?.bio !== undefined &&
      loaded?.role !== undefined &&
      loaded?.linkedin_url !== undefined
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const [profileRes, coachRes] = await Promise.all([
        supabaseClient
          .from("profiles")
          .select(
            "id, full_name, first_name, last_name, avatar_url, role, bio, community_bio, linkedin_url"
          )
          .eq("id", id)
          .maybeSingle(),
        supabaseClient
          .from("coaches")
          .select("id, slug, directory_listed, coach_business_name")
          .eq("id", id)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      const p = profileRes.data as
        | {
            id: string;
            full_name: string | null;
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
            role: string | null;
            bio: string | null;
            community_bio: string | null;
            linkedin_url: string | null;
          }
        | null;
      const c = coachRes.data as
        | {
            id: string;
            slug: string | null;
            directory_listed: boolean | null;
            coach_business_name: string | null;
          }
        | null;

      if (!p && !c) return;
      setLoaded((prev) => ({
        id,
        ...prev,
        ...p,
        bio: p ? resolveCommunityBio(p) : prev?.bio ?? null,
        slug: c?.directory_listed ? c.slug ?? null : null,
        coach_business_name: c?.coach_business_name ?? prev?.coach_business_name ?? null,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId, loaded]);

  const card = loaded ?? profile ?? null;
  const name = useMemo(() => {
    if (card) return displayNameFromProfile(card);
    return "Member";
  }, [card]);
  const initials = profileInitialsFromName(name);
  const subline =
    card?.coach_business_name?.trim() && card.coach_business_name.trim() !== name
      ? card.coach_business_name.trim()
      : null;

  const bio = card?.bio?.trim() || null;
  const linkedinUrl = card?.linkedin_url?.trim() || null;
  const profileId = userId ?? card?.id ?? "";

  const cancelScheduledClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeCard = () => {
    cancelScheduledClose();
    interactingRef.current = false;
    setOpen(false);
    setBioExpanded(false);
    if (profileId) releaseProfileCard(profileId);
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (interactingRef.current) return;
      closeCard();
    }, CLOSE_DELAY_MS);
  };

  const openCard = () => {
    if (!profileId || !canOpenProfileCard(profileId)) return;
    cancelScheduledClose();
    claimProfileCard(profileId);
    setOpen(true);
  };

  const focusMovedToCard = (next: EventTarget | null) => {
    if (!(next instanceof Node)) return false;
    return cardRef.current?.contains(next) ?? false;
  };

  useEffect(() => {
    return () => {
      cancelScheduledClose();
      if (profileId) releaseProfileCard(profileId);
    };
  }, [profileId]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      setBioExpanded(false);
      setBioClamped(false);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || bioExpanded || !bio) {
      setBioClamped(false);
      return;
    }

    const measure = () => {
      const el = bioPreviewRef.current;
      if (!el) return;
      setBioClamped(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const el = bioPreviewRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && el
        ? new ResizeObserver(measure)
        : null;
    resizeObserver?.observe(el);

    return () => {
      resizeObserver?.disconnect();
    };
  }, [open, bio, bioExpanded, card, position]);

  useLayoutEffect(() => {
    if (!open) return;
    const margin = 12;

    const update = () => {
      const trigger = triggerRef.current;
      const cardEl = cardRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const cardWidth = Math.min(CARD_WIDTH_PX, window.innerWidth - margin * 2);
      const unclampedLeft = rect.left + rect.width / 2 - cardWidth / 2;
      const maxLeft = window.innerWidth - cardWidth - margin;
      const left = Math.max(margin, Math.min(unclampedLeft, maxLeft));

      const viewportMaxHeight = window.innerHeight - margin * 2;
      setMaxCardHeight((prev) =>
        prev === viewportMaxHeight ? prev : viewportMaxHeight
      );

      const cardHeight = Math.min(cardEl?.offsetHeight ?? 0, viewportMaxHeight);
      let bottomEdge = rect.top - margin;
      let topEdge = bottomEdge - cardHeight;
      if (topEdge < margin) {
        topEdge = margin;
        bottomEdge = topEdge + cardHeight;
      }

      setPosition((prev) => {
        if (prev?.left === left && prev?.top === bottomEdge) return prev;
        return { left, top: bottomEdge };
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    const cardEl = cardRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && cardEl
        ? new ResizeObserver(update)
        : null;
    resizeObserver?.observe(cardEl);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
    };
  }, [open, card, statusLabel, position, bioExpanded, bioClamped]);

  if (!userId && !profile?.id) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={openCard}
      onMouseLeave={scheduleClose}
      onFocus={openCard}
      onBlur={(event) => {
        if (focusMovedToCard(event.relatedTarget)) return;
        scheduleClose();
      }}
    >
      {children}
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={cardRef}
              className="fixed z-[220] flex w-[45rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                transform: "translateY(-100%)",
                maxHeight:
                  maxCardHeight != null ? `${maxCardHeight}px` : undefined,
              }}
              onMouseEnter={() => {
                interactingRef.current = true;
                openCard();
              }}
              onMouseLeave={() => {
                interactingRef.current = false;
                scheduleClose();
              }}
            >
              <span className="shrink-0 p-8 pb-5">
                <span className="flex items-start gap-4">
                  {card?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-600 ring-1 ring-slate-200">
                      {initials}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-3">
                      <span className="block min-w-0 flex-1 truncate text-2xl font-semibold text-slate-900">
                        {name}
                      </span>
                      {linkedinUrl ? (
                        <a
                          href={linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${name} on LinkedIn`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A66C2] transition hover:bg-sky-50"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <LinkedInIcon className="h-5 w-5" />
                        </a>
                      ) : null}
                    </span>
                    {card?.slug ? (
                      <span className="block truncate text-lg text-slate-500">
                        @{card.slug}
                      </span>
                    ) : null}
                    {subline ? (
                      <span className="block truncate text-lg text-slate-600">
                        {subline}
                      </span>
                    ) : null}
                    {card?.role === "admin" ? (
                      <span className="mt-1 block text-base font-semibold uppercase tracking-wide text-sky-700">
                        Admin
                      </span>
                    ) : null}
                  </span>
                </span>
              </span>
              {bio || statusLabel ? (
                <div
                  className={[
                    "min-w-0 w-full px-8 pb-8 pt-0",
                    bioExpanded ? "min-h-0 flex-1 overflow-y-auto" : "shrink-0",
                  ].join(" ")}
                >
                  {bio ? (
                    bioExpanded ? (
                      <div className="break-words text-lg leading-relaxed text-slate-600">
                        {bio}
                      </div>
                    ) : (
                      <>
                        <div className="relative min-w-0 w-full">
                          <div
                            ref={bioPreviewRef}
                            className="overflow-hidden break-words text-lg leading-relaxed text-slate-600"
                            style={{
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: BIO_LINE_CLAMP,
                              maxHeight: BIO_CLAMP_MAX_HEIGHT,
                            }}
                          >
                            {bio}
                          </div>
                          {bioClamped ? (
                            <div
                              aria-hidden
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/90 to-transparent"
                            />
                          ) : null}
                        </div>
                        {bioClamped ? (
                          <button
                            type="button"
                            className="mt-1 inline-flex items-baseline gap-0.5 font-medium text-sky-600 hover:text-sky-500 hover:underline"
                            onMouseDown={(event) => {
                            event.preventDefault();
                            interactingRef.current = true;
                            cancelScheduledClose();
                            if (profileId) claimProfileCard(profileId);
                            setBioExpanded(true);
                          }}
                          onClick={() => setBioExpanded(true)}
                          >
                            <span className="text-slate-400" aria-hidden>
                              …
                            </span>
                            See more
                          </button>
                        ) : null}
                      </>
                    )
                  ) : null}
                  {statusLabel ? (
                    <div
                      className={[
                        "text-base font-medium text-slate-500",
                        bio ? "mt-4" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {statusLabel}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
