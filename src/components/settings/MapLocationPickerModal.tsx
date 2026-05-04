"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const MapLocationPickerLeaflet = dynamic(
  () =>
    import("./MapLocationPickerLeaflet").then((m) => m.MapLocationPickerLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(420px,55vh)] w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600">
        Loading map…
      </div>
    ),
  }
);

export type MapLocationPickerModalProps = {
  open: boolean;
  title?: string;
  initialLatitude: number | null;
  initialLongitude: number | null;
  onClose: () => void;
  onSave: (lat: number, lng: number) => Promise<void>;
};

export function MapLocationPickerModal({
  open,
  title = "Map location",
  initialLatitude,
  initialLongitude,
  onClose,
  onSave,
}: MapLocationPickerModalProps) {
  const [draftLat, setDraftLat] = useState<number | null>(null);
  const [draftLng, setDraftLng] = useState<number | null>(null);
  const [mapTouched, setMapTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraftLat(null);
      setDraftLng(null);
      setMapTouched(false);
      setError(null);
    }
  }, [open]);

  const handlePosition = useCallback((lat: number, lng: number) => {
    setDraftLat(lat);
    setDraftLng(lng);
    setMapTouched(true);
  }, []);

  if (!open) return null;

  async function handleSave() {
    const lat = draftLat ?? initialLatitude;
    const lng = draftLng ?? initialLongitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Click the map or drag the pin to choose a location.");
      return;
    }
    const hadInitial =
      initialLatitude != null &&
      initialLongitude != null &&
      Number.isFinite(initialLatitude) &&
      Number.isFinite(initialLongitude);
    if (!hadInitial && !mapTouched) {
      setError("Click the map or drag the pin to choose a location.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSave(lat, lng);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="map-picker-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Click anywhere to move the pin, or drag the pin. Then save.
        </p>
        <div className="mt-4">
          <MapLocationPickerLeaflet
            initialLatitude={initialLatitude}
            initialLongitude={initialLongitude}
            onPositionChange={handlePosition}
          />
        </div>
        {error ? (
          <p className="mt-2 text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save pin"}
          </button>
        </div>
      </div>
    </div>
  );
}
