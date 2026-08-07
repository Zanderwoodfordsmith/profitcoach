"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Save } from "lucide-react";

import { MapLocationPickerModal } from "@/components/settings/MapLocationPickerModal";
import { notifyAcademyTrackedActionsChanged } from "@/lib/academy/trackedActionsEvents";
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

type MyLocation = {
  location: string;
  latitude: number | null;
  longitude: number | null;
};

export function CommunityMembersMap() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);
  const [locationDraft, setLocationDraft] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const loadMembers = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const token = await getValidSupabaseAccessToken();
      if (!token) {
        if (!signal?.cancelled)
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
        if (!signal?.cancelled)
          setState({
            status: "error",
            message: body.error ?? "Could not load members map.",
          });
        return;
      }

      if (!signal?.cancelled)
        setState({ status: "ready", members: body.members ?? [] });
    } catch (err) {
      if (!signal?.cancelled)
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Could not load members map.",
        });
    }
  }, []);

  const loadMyLocation = useCallback(async (signal?: { cancelled: boolean }) => {
    const empty: MyLocation = { location: "", latitude: null, longitude: null };
    try {
      const token = await getValidSupabaseAccessToken();
      if (!token) {
        if (!signal?.cancelled) {
          setMyLocation(empty);
          setLocationDraft("");
        }
        return;
      }
      const res = await fetch("/api/coach/profile", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        if (!signal?.cancelled) {
          setMyLocation(empty);
          setLocationDraft("");
        }
        return;
      }
      const data = (await res.json()) as {
        location?: string | null;
        latitude?: number | null;
        longitude?: number | null;
      };
      if (signal?.cancelled) return;
      const next: MyLocation = {
        location: data.location?.trim() ?? "",
        latitude:
          typeof data.latitude === "number" && Number.isFinite(data.latitude)
            ? data.latitude
            : null,
        longitude:
          typeof data.longitude === "number" && Number.isFinite(data.longitude)
            ? data.longitude
            : null,
      };
      setMyLocation(next);
      setLocationDraft(next.location);
    } catch {
      if (!signal?.cancelled) {
        setMyLocation(empty);
        setLocationDraft("");
      }
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    setState({ status: "loading" });
    void loadMembers(signal);
    void loadMyLocation(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadMembers, loadMyLocation, reloadKey]);

  async function patchProfile(body: Record<string, unknown>) {
    const token = await getValidSupabaseAccessToken();
    if (!token) throw new Error("Not signed in.");
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(payload.error ?? "Could not save location.");
    notifyAcademyTrackedActionsChanged();
  }

  async function saveLocationText() {
    const next = locationDraft.trim();
    if (next === (myLocation?.location ?? "")) return;
    setLocationSaving(true);
    setLocationError(null);
    setLocationMessage(null);
    try {
      await patchProfile({ location: next || null });
      setLocationMessage(next ? "Location saved." : "Location cleared.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLocationSaving(false);
    }
  }

  async function persistMapPin(lat: number, lng: number) {
    setLocationError(null);
    setLocationMessage(null);
    await patchProfile({ map_latitude: lat, map_longitude: lng });
    setLocationMessage("Map pin saved.");
    setReloadKey((k) => k + 1);
  }

  const hasPin =
    myLocation?.latitude != null &&
    myLocation?.longitude != null &&
    Number.isFinite(myLocation.latitude) &&
    Number.isFinite(myLocation.longitude);

  const locationDirty = locationDraft.trim() !== (myLocation?.location ?? "");

  return (
    <div className="relative z-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative z-0 h-[calc(100vh-220px)] min-h-[480px] w-full">
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
            No members have a mappable location yet. Add yours with the box in
            the top right, then place a pin.
          </div>
        ) : (
          <MembersMapLeaflet members={state.members} />
        )}

        {state.status !== "loading" ? (
          <div className="absolute right-3 top-3 z-[1000] w-[min(18.5rem,calc(100%-1.5rem))] rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Your location
            </p>
            <label className="sr-only" htmlFor="community-map-location">
              City, region, country
            </label>
            <div className="mt-1.5 flex gap-1.5">
              <input
                id="community-map-location"
                type="text"
                value={locationDraft}
                onChange={(e) => {
                  setLocationDraft(e.target.value);
                  setLocationMessage(null);
                  setLocationError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveLocationText();
                  }
                }}
                placeholder="City, region, country"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                onClick={() => void saveLocationText()}
                disabled={locationSaving || !locationDirty}
                title="Save location"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPinModalOpen(true)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <MapPin className="h-3.5 w-3.5 text-sky-700" aria-hidden />
              {hasPin ? "Update map pin" : "Place pin on map"}
            </button>
            {locationMessage ? (
              <p className="mt-1.5 text-[11px] text-emerald-700">{locationMessage}</p>
            ) : null}
            {locationError ? (
              <p className="mt-1.5 text-[11px] text-rose-600">{locationError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {state.status === "ready" && state.members.length > 0 ? (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Showing {state.members.length} member
          {state.members.length === 1 ? "" : "s"} with a mapped location.
        </div>
      ) : null}

      <MapLocationPickerModal
        open={pinModalOpen}
        title="Your map pin"
        initialLatitude={myLocation?.latitude ?? null}
        initialLongitude={myLocation?.longitude ?? null}
        onClose={() => setPinModalOpen(false)}
        onSave={persistMapPin}
      />
    </div>
  );
}
