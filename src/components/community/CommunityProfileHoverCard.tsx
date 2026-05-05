"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseClient } from "@/lib/supabaseClient";
import { displayNameFromProfile, profileInitialsFromName } from "@/lib/communityProfile";

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
};

type Props = {
  userId?: string | null;
  profile?: HoverProfile | null;
  statusLabel?: string | null;
  children: React.ReactNode;
};

export function CommunityProfileHoverCard({
  userId,
  profile,
  statusLabel,
  children,
}: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<HoverProfile | null>(profile ?? null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );

  useEffect(() => {
    setLoaded(profile ?? null);
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    const id = userId ?? loaded?.id ?? null;
    if (!id) return;
    if (loaded?.bio !== undefined && loaded?.role !== undefined) return;

    let cancelled = false;
    void (async () => {
      const [profileRes, coachRes] = await Promise.all([
        supabaseClient
          .from("profiles")
          .select("id, full_name, first_name, last_name, avatar_url, role, bio")
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

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cardWidth = 448; // w-[28rem]
      const margin = 12;
      const unclampedLeft = rect.left + rect.width / 2 - cardWidth / 2;
      const maxLeft = window.innerWidth - cardWidth - margin;
      const left = Math.max(margin, Math.min(unclampedLeft, maxLeft));
      const top = Math.max(margin, rect.top - margin);
      setPosition({ left, top });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  if (!userId && !profile?.id) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[220] w-[28rem] rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                transform: "translateY(-100%)",
              }}
            >
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
                  <span className="block truncate text-2xl font-semibold text-slate-900">
                    {name}
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
              {card?.bio ? (
                <span className="mt-4 block line-clamp-3 text-lg leading-relaxed text-slate-600">
                  {card.bio}
                </span>
              ) : null}
              {statusLabel ? (
                <span className="mt-4 block text-base font-medium text-slate-500">
                  {statusLabel}
                </span>
              ) : null}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
