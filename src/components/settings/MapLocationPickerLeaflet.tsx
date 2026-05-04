"use client";

import "leaflet/dist/leaflet.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

const PIN_HTML = `
<svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M16 0a14 14 0 0 0-14 14c0 9.9 13.1 24.6 13.7 25.2a.7.7 0 0 0 .6 0C16.9 38.6 30 23.9 30 14A14 14 0 0 0 16 0z" fill="#0c5290"/>
  <circle cx="16" cy="14" r="6" fill="#fff"/>
</svg>
`;

const pinIcon = L.divIcon({
  className: "pc-map-pin",
  html: PIN_HTML,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

function MapEvents({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export type MapLocationPickerLeafletProps = {
  initialLatitude: number | null;
  initialLongitude: number | null;
  onPositionChange?: (lat: number, lng: number) => void;
};

export function MapLocationPickerLeaflet({
  initialLatitude,
  initialLongitude,
  onPositionChange,
}: MapLocationPickerLeafletProps) {
  const fallback = useMemo<[number, number]>(() => [20, 0], []);
  const [pos, setPos] = useState<[number, number]>(() =>
    initialLatitude != null &&
      initialLongitude != null &&
      Number.isFinite(initialLatitude) &&
      Number.isFinite(initialLongitude)
      ? [initialLatitude, initialLongitude]
      : fallback
  );

  useEffect(() => {
    if (
      initialLatitude != null &&
      initialLongitude != null &&
      Number.isFinite(initialLatitude) &&
      Number.isFinite(initialLongitude)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync marker when saved coords load
      setPos([initialLatitude, initialLongitude]);
    }
  }, [initialLatitude, initialLongitude]);

  const zoom =
    initialLatitude != null &&
    initialLongitude != null &&
    Number.isFinite(initialLatitude) &&
    Number.isFinite(initialLongitude)
      ? 11
      : 2;

  const notify = useCallback(
    (lat: number, lng: number) => {
      setPos([lat, lng]);
      onPositionChange?.(lat, lng);
    },
    [onPositionChange]
  );

  return (
    <MapContainer
      center={pos}
      zoom={zoom}
      minZoom={2}
      maxZoom={18}
      worldCopyJump
      scrollWheelZoom
      className="h-[min(420px,55vh)] w-full rounded-lg border border-slate-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />
      <MapEvents onPick={notify} />
      <Marker
        position={pos}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const p = e.target.getLatLng();
            notify(p.lat, p.lng);
          },
        }}
      />
    </MapContainer>
  );
}
