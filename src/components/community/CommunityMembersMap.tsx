"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

export type MapMember = {
  id: string;
  slug: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  lat: number;
  lng: number;
  directory_listed: boolean;
};

// Leaflet touches `window` at module load, so we defer it to the browser.
const MembersMapLeaflet = dynamic(
  () =>
    import("./MembersMapLeaflet").then((m) => m.MembersMapLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
        Loading map…
      </div>
    ),
  }
);

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; members: MapMember[] };

export function CommunityMembersMap() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getValidSupabaseAccessToken();
        if (!token) {
          if (!cancelled)
            setState({
              status: "error",
              message: "Sign in again to view the members map.",
            });
          return;
        }

        const res = await fetch("/api/community/members-map", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as {
          members?: MapMember[];
          error?: string;
        };

        if (!res.ok) {
          if (!cancelled)
            setState({
              status: "error",
              message: body.error ?? "Could not load members map.",
            });
          return;
        }

        if (!cancelled)
          setState({ status: "ready", members: body.members ?? [] });
      } catch (err) {
        if (!cancelled)
          setState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not load members map.",
          });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-[calc(100vh-220px)] min-h-[480px] w-full">
        {state.status === "loading" ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
            Loading members map…
          </div>
        ) : state.status === "error" ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-rose-600">
            {state.message}
          </div>
        ) : state.members.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-slate-500">
            No members have a mappable location yet. Add a city and country (or
            address) under Settings → Profile, save, and you&apos;ll show up here.
          </div>
        ) : (
          <MembersMapLeaflet members={state.members} />
        )}
      </div>
      {state.status === "ready" && state.members.length > 0 ? (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Showing {state.members.length} member
          {state.members.length === 1 ? "" : "s"} with a mapped location.
        </div>
      ) : null}
    </div>
  );
}
