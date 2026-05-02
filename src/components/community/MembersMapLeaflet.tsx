"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import type { MapMember } from "./CommunityMembersMap";
import { MemberInfoCard } from "./MemberInfoCard";

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
  popupAnchor: [0, -34],
});

function clusterIconCreate(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 44 : count < 200 ? 52 : 60;
  return L.divIcon({
    className: "pc-map-cluster",
    html: `<div class="pc-map-cluster__bubble" style="width:${size}px;height:${size}px;line-height:${size}px;">${count}</div>`,
    iconSize: [size, size],
  });
}

export type MembersMapLeafletProps = {
  members: MapMember[];
};

export function MembersMapLeaflet({ members }: MembersMapLeafletProps) {
  const center = useMemo<[number, number]>(() => {
    if (members.length === 0) return [20, 0];
    const lat =
      members.reduce((s, m) => s + m.lat, 0) / members.length;
    const lng =
      members.reduce((s, m) => s + m.lng, 0) / members.length;
    return [lat, lng];
  }, [members]);

  return (
    <MapContainer
      center={center}
      zoom={members.length > 0 ? 3 : 2}
      minZoom={2}
      maxZoom={18}
      worldCopyJump
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={55}
        iconCreateFunction={clusterIconCreate}
      >
        {members.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={pinIcon}>
            <Popup
              minWidth={260}
              maxWidth={320}
              closeButton={false}
              className="pc-map-popup"
            >
              <MemberInfoCard member={m} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
