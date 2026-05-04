"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { MapLocationPickerModal } from "@/components/settings/MapLocationPickerModal";
import { ProfileAvatarPicker } from "@/components/settings/ProfileAvatarPicker";
import {
  OutlinedTextArea,
  OutlinedTextField,
} from "@/components/settings/OutlinedFormField";

type ProfileData = {
  first_name: string | null;
  last_name: string | null;
  full_name?: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_geocoded_source?: string | null;
};

export function AdminProfileTab() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/coach/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      setError("Could not load profile.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as ProfileData;
    setProfile(data);
    setFirstName(data.first_name ?? "");
    setLastName(data.last_name ?? "");
    setBio(data.bio ?? "");
    setLocation(data.location ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap profile after session
    void loadProfile();
  }, [loadProfile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveOk(false);
    setSaveErr(null);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    setSaving(true);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (res.ok) {
      setSaveOk(true);
      void loadProfile();
    } else {
      setSaveErr(body.error ?? "Save failed.");
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setAvatarError("Not signed in.");
      setUploadingAvatar(false);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/coach/avatar", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });
    setUploadingAvatar(false);
    if (res.ok) {
      const b = (await res.json()) as { avatar_url?: string };
      setProfile((prev) =>
        prev ? { ...prev, avatar_url: b.avatar_url ?? null } : null
      );
    } else {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setAvatarError(b.error ?? "Upload failed.");
    }
    e.target.value = "";
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setRemovingAvatar(true);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setAvatarError("Not signed in.");
      setRemovingAvatar(false);
      return;
    }
    const res = await fetch("/api/coach/avatar", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setRemovingAvatar(false);
    if (res.ok) {
      setProfile((prev) =>
        prev ? { ...prev, avatar_url: null } : null
      );
    } else {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setAvatarError(b.error ?? "Could not remove avatar.");
    }
  }

  async function persistMapPin(lat: number, lng: number) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error("Not signed in.");
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ map_latitude: lat, map_longitude: lng }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not save map pin.");
    await loadProfile();
  }

  async function clearMapPin() {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/api/coach/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clear_map_pin: true }),
    });
    void loadProfile();
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading profile…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (!profile) return null;

  const hasMapPin =
    profile.latitude != null &&
    profile.longitude != null &&
    Number.isFinite(profile.latitude) &&
    Number.isFinite(profile.longitude);

  return (
    <>
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-6"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            <ProfileAvatarPicker
              avatarUrl={profile.avatar_url}
              firstName={firstName}
              lastName={lastName}
              fullName={profile.full_name}
              uploading={uploadingAvatar}
              error={avatarError}
              onFileSelected={handleAvatarChange}
              onRemoveAvatar={handleRemoveAvatar}
              removing={removingAvatar}
            />
            <div className="min-w-0 max-w-xl flex-1">
          <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <OutlinedTextField
              id="admin_first_name"
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              wrapperClassName="w-full min-w-0"
            />
            <OutlinedTextField
              id="admin_last_name"
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              wrapperClassName="w-full min-w-0"
            />
          </div>
            </div>
          </div>
          <div className="mt-8 max-w-lg space-y-4 border-t border-slate-100 pt-8">
            <OutlinedTextArea
              id="admin_bio"
              label="Bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              wrapperClassName="w-full max-w-lg"
            />
          <div>
            <OutlinedTextField
              id="admin_location"
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, region, country"
              autoComplete="address-level2"
              wrapperClassName="w-full max-w-md"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMapModalOpen(true)}
                className="font-medium text-sky-700 hover:underline"
              >
                Change my map location
              </button>
              {hasMapPin ? (
                <button
                  type="button"
                  onClick={() => void clearMapPin()}
                  className="text-slate-500 hover:text-rose-600 hover:underline"
                >
                  Remove my map location
                </button>
              ) : null}
            </div>
            {profile.location_geocoded_source === "manual" ? (
              <p className="mt-2 text-xs text-slate-500">
                Pin placed manually — changing the text above won&apos;t move the
                pin until you remove it or pick a new spot on the map.
              </p>
            ) : null}
          </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {saveOk ? (
            <span className="text-sm text-green-700">Saved.</span>
          ) : null}
          {saveErr ? (
            <span className="text-sm text-rose-600">{saveErr}</span>
          ) : null}
        </div>
      </form>

      <MapLocationPickerModal
        open={mapModalOpen}
        initialLatitude={profile.latitude ?? null}
        initialLongitude={profile.longitude ?? null}
        onClose={() => setMapModalOpen(false)}
        onSave={persistMapPin}
      />
    </>
  );
}
