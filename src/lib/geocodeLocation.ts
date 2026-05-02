/**
 * Free-text → lat/lng via OSM Nominatim. Server-side only.
 *
 * Nominatim free tier policy:
 *   - Max 1 request per second
 *   - A descriptive User-Agent identifying the app + contact
 *   - https://operations.osmfoundation.org/policies/nominatim/
 *
 * This module enforces a single in-process 1.1s throttle and never throws —
 * callers can rely on a `null` result meaning "no coords; do not pin on map".
 */

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
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
    const url = new URL(NOMINATIM_ENDPOINT);
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
