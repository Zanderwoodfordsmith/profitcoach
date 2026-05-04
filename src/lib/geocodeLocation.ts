/**
 * Geocoding via OSM Nominatim (forward + reverse). Server-side only.
 *
 * Nominatim free tier policy:
 *   - Max 1 request per second
 *   - A descriptive User-Agent identifying the app + contact
 *   - https://operations.osmfoundation.org/policies/nominatim/
 *
 * This module enforces a single in-process 1.1s throttle and never throws —
 * callers can rely on a `null` result meaning "no coords / no label".
 */

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const MIN_INTERVAL_MS = 1100;

const USER_AGENT =
  process.env.GEOCODER_USER_AGENT ??
  "profit-coach-app/1.0 (community-members-map)";

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

async function throttle(): Promise<void> {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

export type GeocodeResult = { lat: number; lng: number };

export async function geocodeLocation(
  query: string
): Promise<GeocodeResult | null> {
  const q = (query ?? "").trim();
  if (!q) return null;

  const run = async (): Promise<GeocodeResult | null> => {
    await throttle();
    const url = new URL(NOMINATIM_SEARCH);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", q);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        console.warn(
          `geocodeLocation: nominatim returned ${res.status} for "${q}"`
        );
        return null;
      }
      const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const first = Array.isArray(body) ? body[0] : null;
      if (!first?.lat || !first?.lon) return null;
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch (err) {
      console.warn(`geocodeLocation: failed for "${q}":`, err);
      return null;
    }
  };

  // Serialize concurrent callers so we never burst Nominatim.
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

type NominatimAddress = Record<string, string | undefined>;

function labelFromReversePayload(data: {
  display_name?: string;
  address?: NominatimAddress;
}): string | null {
  const a = data.address;
  if (a) {
    const locality =
      a.city ??
      a.town ??
      a.village ??
      a.hamlet ??
      a.suburb ??
      a.municipality ??
      a.city_district ??
      "";
    const region = a.state ?? a.region ?? a.county ?? "";
    const country = a.country ?? "";
    const parts = [locality, region, country].map((s) => (s ?? "").trim()).filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  const dn = (data.display_name ?? "").trim();
  if (!dn) return null;
  return dn.length > 120 ? `${dn.slice(0, 117)}…` : dn;
}

/**
 * lat/lng → short display place name via OSM Nominatim reverse. Server-side only.
 * Shares the same throttle queue as {@link geocodeLocation}.
 */
export async function reverseGeocodeLocation(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const run = async (): Promise<string | null> => {
    await throttle();
    const url = new URL(NOMINATIM_REVERSE);
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));

    try {
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        console.warn(
          `reverseGeocodeLocation: nominatim returned ${res.status} for ${lat},${lng}`
        );
        return null;
      }
      const body = (await res.json()) as {
        display_name?: string;
        address?: NominatimAddress;
        error?: string;
      };
      if (body.error) {
        console.warn(`reverseGeocodeLocation: nominatim error: ${body.error}`);
        return null;
      }
      return labelFromReversePayload(body);
    } catch (err) {
      console.warn(`reverseGeocodeLocation: failed for ${lat},${lng}:`, err);
      return null;
    }
  };

  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
