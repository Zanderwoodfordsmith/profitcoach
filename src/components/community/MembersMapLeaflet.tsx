"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { MapMemberPinHoverOverlay } from "@/components/community/MapMemberPinHoverOverlay";

import type { MapMember } from "./CommunityMembersMap";

const SOLO_PIN_WIDTH = 140;
const SOLO_PIN_HEIGHT = 58;
const SOLO_PIN_TIP_Y = 40;

const memberByLeafletMarker = new WeakMap<L.Marker, MapMember>();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createSoloMemberMountIcon(memberId: string): L.DivIcon {
  return L.divIcon({
    className: "pc-map-pin pc-map-pin-solo-wrap",
    html: `<div data-pc-map-member-id="${escapeHtml(memberId)}" class="pc-map-pin-solo-root"></div>`,
    iconSize: [SOLO_PIN_WIDTH, SOLO_PIN_HEIGHT],
    iconAnchor: [SOLO_PIN_WIDTH / 2, SOLO_PIN_TIP_Y],
  });
}

function clusterIconCreate(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  if (count === 1) {
    const child = cluster.getAllChildMarkers()[0];
    const member = child ? memberByLeafletMarker.get(child) : undefined;
    if (member) return createSoloMemberMountIcon(member.id);
  }

  const size = count < 10 ? 36 : count < 50 ? 44 : count < 200 ? 52 : 60;
  return L.divIcon({
    className: "pc-map-cluster",
    html: `<div class="pc-map-cluster__bubble" style="width:${size}px;height:${size}px;line-height:${size}px;">${count}</div>`,
    iconSize: [size, size],
  });
}

function MemberMapMarker({ member }: { member: MapMember }) {
  const icon = useMemo(
    () => createSoloMemberMountIcon(member.id),
    [member.id]
  );

  return (
    <Marker
      position={[member.lat, member.lng]}
      icon={icon}
      eventHandlers={{
        add: (event) => {
          memberByLeafletMarker.set(event.target, member);
        },
        remove: (event) => {
          memberByLeafletMarker.delete(event.target);
        },
      }}
    />
  );
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
      <MapMemberPinHoverOverlay members={members} />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={55}
        iconCreateFunction={clusterIconCreate}
      >
        {members.map((m) => (
          <MemberMapMarker key={m.id} member={m} />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
