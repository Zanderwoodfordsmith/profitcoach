"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { setWorkerUrl } from "maplibre-gl";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

export function BasemapLayer() {
  const map = useMap();

  useEffect(() => {
    // public/maplibre/* must stay in sync with the installed maplibre-gl version.
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const layer = maplibreGL({
      style: STYLE,
      attributionControl: { customAttribution: ATTRIBUTION },
    });
    layer.addTo(map);
    const container = layer.getContainer();
    container.style.position = "absolute";
    container.style.zIndex = "0";
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);

  return null;
}
