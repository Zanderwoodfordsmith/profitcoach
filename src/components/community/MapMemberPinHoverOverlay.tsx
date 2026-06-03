"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { useMap, useMapEvents } from "react-leaflet";

import {
  CommunityMemberProfileHoverTrigger,
  communityMemberStatusLabel,
  type CommunityMemberHoverProfile,
} from "@/components/community/communityMemberProfileHover";
import { MapMemberSoloPin } from "@/components/community/MapMemberSoloPin";
import { useCommunityMemberDirectory } from "@/components/community/useCommunityMemberDirectory";

import type { MapMember } from "./CommunityMembersMap";

type PinLayout = {
  key: string;
  memberId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

function isMarkerClusterGroup(
  layer: L.Layer
): layer is L.MarkerClusterGroup {
  return typeof (layer as L.MarkerClusterGroup).refreshClusters === "function";
}

function mapMemberToHoverProfile(member: MapMember): CommunityMemberHoverProfile {
  return {
    id: member.id,
    full_name: member.full_name,
    coach_business_name: member.coach_business_name,
    avatar_url: member.avatar_url,
    bio: member.bio,
    slug: member.slug,
  };
}

function MapMemberPinHover({
  member,
  statusLabel,
}: {
  member: MapMember;
  statusLabel?: string | null;
}) {
  return (
    <CommunityMemberProfileHoverTrigger
      member={mapMemberToHoverProfile(member)}
      statusLabel={statusLabel}
    >
      <MapMemberSoloPin member={member} />
    </CommunityMemberProfileHoverTrigger>
  );
}

export function MapMemberPinHoverOverlay({
  members,
}: {
  members: MapMember[];
}) {
  const map = useMap();
  const { lastSeenByUserId, clock, presenceUnavailable } =
    useCommunityMemberDirectory();
  const [layouts, setLayouts] = useState<PinLayout[]>([]);
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const syncLayouts = useCallback(() => {
    const container = map.getContainer();
    const containerRect = container.getBoundingClientRect();
    const mounts = container.querySelectorAll<HTMLElement>(
      "[data-pc-map-member-id]"
    );
    const next: PinLayout[] = [];

    mounts.forEach((mountEl, index) => {
      const memberId = mountEl.dataset.pcMapMemberId;
      if (!memberId) return;

      const rect = mountEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      next.push({
        key: `${memberId}-${index}`,
        memberId,
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      });
    });

    setLayouts(next);
  }, [map]);

  const scheduleSync = useCallback(() => {
    window.requestAnimationFrame(syncLayouts);
  }, [syncLayouts]);

  useMapEvents({
    move: scheduleSync,
    zoom: scheduleSync,
    resize: scheduleSync,
    moveend: scheduleSync,
    zoomend: scheduleSync,
  });

  useEffect(() => {
    const container = map.getContainer();
    let overlay = container.querySelector<HTMLElement>(
      ".pc-map-pin-hover-overlay"
    );
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "pc-map-pin-hover-overlay";
      container.appendChild(overlay);
    }
    setOverlayEl(overlay);

    return () => {
      overlay?.remove();
      setOverlayEl(null);
    };
  }, [map]);

  useEffect(() => {
    const bindClusterGroup = () => {
      map.eachLayer((layer) => {
        if (isMarkerClusterGroup(layer)) {
          layer.off("animationend", scheduleSync);
          layer.on("animationend", scheduleSync);
        }
      });
    };

    const onLayerAdd = () => {
      bindClusterGroup();
      scheduleSync();
    };

    map.whenReady(() => {
      bindClusterGroup();
      scheduleSync();
    });
    map.on("layeradd", onLayerAdd);
    map.on("layerremove", scheduleSync);

    return () => {
      map.off("layeradd", onLayerAdd);
      map.off("layerremove", scheduleSync);
      map.eachLayer((layer) => {
        if (isMarkerClusterGroup(layer)) {
          layer.off("animationend", scheduleSync);
        }
      });
    };
  }, [map, scheduleSync]);

  useEffect(() => {
    scheduleSync();
  }, [members, scheduleSync]);

  if (!overlayEl) return null;

  return createPortal(
    <>
      {layouts.map((layout) => {
        const member = memberById.get(layout.memberId);
        if (!member) return null;

        const statusLabel = presenceUnavailable
          ? null
          : communityMemberStatusLabel(lastSeenByUserId[member.id], clock);

        return (
          <div
            key={layout.key}
            className="pointer-events-auto absolute"
            style={{
              left: layout.left,
              top: layout.top,
              width: layout.width,
              height: layout.height,
            }}
          >
            <MapMemberPinHover member={member} statusLabel={statusLabel} />
          </div>
        );
      })}
    </>,
    overlayEl
  );
}
