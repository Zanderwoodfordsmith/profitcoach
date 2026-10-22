import { UK_GRID, WORLD_GRID } from "./mapDots";

/**
 * Where a coach is, read from the free-text location on their profile: the
 * town or county they wrote, else the point it was geocoded to, else the
 * country. A location nothing here matches still lists; it just gets no pin.
 */

/** UK regions (and Ireland) as the map groups its dots, north to south. */
export const UK_REGIONS = [
  { id: "scotland", label: "Scotland" },
  { id: "northern-ireland", label: "Northern Ireland" },
  { id: "ireland", label: "Ireland" },
  { id: "north-east", label: "North East" },
  { id: "north-west", label: "North West" },
  { id: "yorkshire", label: "Yorkshire" },
  { id: "wales", label: "Wales" },
  { id: "west-midlands", label: "West Midlands" },
  { id: "east-midlands", label: "East Midlands" },
  { id: "east", label: "East of England" },
  { id: "london", label: "London" },
  { id: "south-west", label: "South West" },
  { id: "south-east", label: "South East" },
] as const;

export type RegionId = (typeof UK_REGIONS)[number]["id"];

export type Place = {
  /** ISO country code, e.g. GB. */
  country: string;
  /** UK region, or "ireland"; null outside the British Isles. */
  region: RegionId | null;
  /** Null when only the country is known. */
  lat: number | null;
  lng: number | null;
};

type Entry = [RegExp, number, number, RegionId | null, string];

// First match wins, so specific names sit above the broad ones they contain.
const PLACES: Entry[] = [
  [/new york/, 40.71, -74.01, null, "US"],
  [/northern ireland|belfast/, 54.6, -5.93, "northern-ireland", "GB"],
  [/dublin/, 53.35, -6.26, "ireland", "IE"],
  [/\bcork\b/, 51.9, -8.47, "ireland", "IE"],
  [/galway/, 53.27, -9.05, "ireland", "IE"],
  [/ireland|\beire\b/, 53.2, -7.9, "ireland", "IE"],

  [/london/, 51.51, -0.13, "london", "GB"],
  [/guildford|\bgu\d/, 51.24, -0.57, "south-east", "GB"],
  [/henfield/, 50.93, -0.27, "south-east", "GB"],
  [/st\.? leonards|hastings/, 50.86, 0.56, "south-east", "GB"],
  [/hampshire|winchester/, 51.03, -1.1, "south-east", "GB"],
  [/brighton/, 50.82, -0.14, "south-east", "GB"],
  [/oxford/, 51.75, -1.26, "south-east", "GB"],
  [/\breading\b|berkshire/, 51.45, -0.97, "south-east", "GB"],
  [/milton keynes|buckinghamshire/, 52.04, -0.76, "south-east", "GB"],
  [/southampton/, 50.9, -1.4, "south-east", "GB"],
  [/portsmouth/, 50.8, -1.09, "south-east", "GB"],
  [/\bkent\b|maidstone|canterbury/, 51.27, 0.72, "south-east", "GB"],
  [/surrey/, 51.25, -0.4, "south-east", "GB"],
  [/sussex/, 50.93, -0.3, "south-east", "GB"],

  [/sherborne/, 50.95, -2.52, "south-west", "GB"],
  [/dorset|bournemouth|poole/, 50.75, -2.1, "south-west", "GB"],
  [/cotswolds?/, 51.83, -1.83, "south-west", "GB"],
  [/bristol/, 51.45, -2.59, "south-west", "GB"],
  [/\bbath\b/, 51.38, -2.36, "south-west", "GB"],
  [/exeter|devon/, 50.72, -3.53, "south-west", "GB"],
  [/plymouth/, 50.38, -4.14, "south-west", "GB"],
  [/cornwall/, 50.4, -4.9, "south-west", "GB"],
  [/somerset|taunton/, 51.02, -3.1, "south-west", "GB"],
  [/cheltenham/, 51.9, -2.07, "south-west", "GB"],
  [/gloucester/, 51.86, -2.24, "south-west", "GB"],
  [/swindon|wiltshire/, 51.56, -1.78, "south-west", "GB"],

  [/cambridge/, 52.21, 0.12, "east", "GB"],
  [/suffolk|ipswich/, 52.19, 1.0, "east", "GB"],
  [/norwich|norfolk/, 52.63, 1.3, "east", "GB"],
  [/essex|chelmsford|colchester/, 51.74, 0.47, "east", "GB"],
  [/hertfordshire|st albans/, 51.8, -0.2, "east", "GB"],
  [/bedford/, 52.14, -0.47, "east", "GB"],
  [/peterborough/, 52.57, -0.24, "east", "GB"],

  [/leicester/, 52.64, -1.13, "east-midlands", "GB"],
  [/grindleford/, 53.3, -1.63, "east-midlands", "GB"],
  [/derbyshire|\bderby\b/, 53.0, -1.55, "east-midlands", "GB"],
  [/nottingham/, 52.95, -1.15, "east-midlands", "GB"],
  [/lincoln/, 53.23, -0.54, "east-midlands", "GB"],
  [/northampton/, 52.24, -0.9, "east-midlands", "GB"],

  [/birmingham/, 52.49, -1.89, "west-midlands", "GB"],
  [/warwick/, 52.28, -1.58, "west-midlands", "GB"],
  [/coventry/, 52.41, -1.51, "west-midlands", "GB"],
  [/wolverhampton/, 52.59, -2.13, "west-midlands", "GB"],
  [/worcester/, 52.19, -2.22, "west-midlands", "GB"],
  [/stoke/, 53.0, -2.18, "west-midlands", "GB"],
  [/shropshire|shrewsbury/, 52.7, -2.75, "west-midlands", "GB"],
  [/stafford/, 52.8, -2.1, "west-midlands", "GB"],

  [/wirral/, 53.37, -3.07, "north-west", "GB"],
  [/\bchester\b/, 53.19, -2.89, "north-west", "GB"],
  [/alderley edge/, 53.3, -2.24, "north-west", "GB"],
  [/wigan/, 53.55, -2.63, "north-west", "GB"],
  [/manchester/, 53.48, -2.24, "north-west", "GB"],
  [/liverpool/, 53.41, -2.98, "north-west", "GB"],
  [/cheshire/, 53.2, -2.5, "north-west", "GB"],
  [/lancashire|preston/, 53.76, -2.7, "north-west", "GB"],
  [/cumbria|carlisle/, 54.6, -2.9, "north-west", "GB"],

  [/\bhull\b/, 53.74, -0.34, "yorkshire", "GB"],
  [/north yorkshire|harrogate/, 54.1, -1.4, "yorkshire", "GB"],
  [/\byork\b/, 53.96, -1.08, "yorkshire", "GB"],
  [/leeds/, 53.8, -1.55, "yorkshire", "GB"],
  [/sheffield/, 53.38, -1.47, "yorkshire", "GB"],
  [/bradford/, 53.79, -1.75, "yorkshire", "GB"],
  [/yorkshire/, 53.9, -1.3, "yorkshire", "GB"],

  [/newcastle/, 54.98, -1.61, "north-east", "GB"],
  [/sunderland/, 54.9, -1.38, "north-east", "GB"],
  [/durham/, 54.78, -1.57, "north-east", "GB"],
  [/teesside|middlesbrough/, 54.57, -1.23, "north-east", "GB"],

  [/edinburgh/, 55.95, -3.19, "scotland", "GB"],
  [/glasgow/, 55.86, -4.25, "scotland", "GB"],
  [/aberdeen/, 57.15, -2.09, "scotland", "GB"],
  [/dundee/, 56.46, -2.97, "scotland", "GB"],
  [/inverness/, 57.48, -4.22, "scotland", "GB"],
  [/scotland/, 56.5, -4.2, "scotland", "GB"],

  [/cardiff/, 51.48, -3.18, "wales", "GB"],
  [/swansea/, 51.62, -3.94, "wales", "GB"],
  [/wales/, 52.3, -3.7, "wales", "GB"],

  [/munich|münchen/, 48.14, 11.58, null, "DE"],
  [/berlin/, 52.52, 13.4, null, "DE"],
  [/germany/, 51.1, 10.4, null, "DE"],
  [/monterrey/, 25.69, -100.32, null, "MX"],
  [/mexico/, 23.6, -102.5, null, "MX"],
  [/paris/, 48.86, 2.35, null, "FR"],
  [/france/, 46.6, 2.4, null, "FR"],
  [/madrid/, 40.42, -3.7, null, "ES"],
  [/barcelona/, 41.39, 2.17, null, "ES"],
  [/spain/, 40.4, -3.7, null, "ES"],
  [/portugal|lisbon/, 38.72, -9.14, null, "PT"],
  [/amsterdam|netherlands/, 52.37, 4.9, null, "NL"],
  [/dubai|\buae\b|united arab emirates/, 25.2, 55.27, null, "AE"],
  [/toronto/, 43.65, -79.38, null, "CA"],
  [/canada/, 56, -106, null, "CA"],
  [/\busa\b|united states/, 39.8, -98.6, null, "US"],
  [/sydney/, -33.87, 151.21, null, "AU"],
  [/melbourne/, -37.81, 144.96, null, "AU"],
  [/australia/, -25, 134, null, "AU"],
  [/new zealand|auckland/, -36.85, 174.76, null, "NZ"],
  [/cape town/, -33.92, 18.42, null, "ZA"],
  [/johannesburg/, -26.2, 28.04, null, "ZA"],
  [/south africa/, -29, 24, null, "ZA"],
  [/singapore/, 1.35, 103.82, null, "SG"],
];

const UK_ONLY = /\b(uk|u\.k\.|united kingdom|england|great britain|britain|gb)\b/;

/** The dot-map group under a point, looking one cell around for coastlines. */
function groupAt(grid: typeof UK_GRID, lat: number, lng: number): string | null {
  const col = Math.round(((lng - grid.west) * grid.k) / grid.step);
  const row = Math.round((grid.north - lat) / grid.step);
  for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const [group, pairs] of Object.entries(grid.dots)) {
      for (let i = 0; i < pairs.length; i += 2) {
        if (pairs[i] === col + dc && pairs[i + 1] === row + dr) return group;
      }
    }
  }
  return null;
}

/** A geocoded point as a place: its UK region, else its country. */
function placeAt(lat: number, lng: number): Place | null {
  const region = groupAt(UK_GRID, lat, lng);
  if (region && region !== "isle-of-man") {
    return { country: region === "ireland" ? "IE" : "GB", region: region as RegionId, lat, lng };
  }
  const country = groupAt(WORLD_GRID, lat, lng);
  return country ? { country, region: null, lat, lng } : null;
}

/** The typed location wins (geocoders misread places like "The Cotswolds"); the stored point fills gaps. */
export function placeFor(
  location: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
): Place | null {
  const text = location?.toLowerCase().trim();
  if (!text) return null;
  for (const [re, pLat, pLng, region, country] of PLACES) {
    if (re.test(text)) return { country, region, lat: pLat, lng: pLng };
  }
  const geocoded = lat != null && lng != null ? placeAt(lat, lng) : null;
  if (geocoded) return geocoded;
  return UK_ONLY.test(text) ? { country: "GB", region: null, lat: null, lng: null } : null;
}

export function regionLabel(id: string): string | null {
  return UK_REGIONS.find((r) => r.id === id)?.label ?? null;
}
